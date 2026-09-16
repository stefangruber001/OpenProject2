import SwiftUI
import Combine

/// App-wide state: owns one long-lived `WebViewStore` per tab (so pages keep
/// their state when you switch tabs), the current selection, and the item to
/// present in the share sheet.
@MainActor
final class AppState: ObservableObject {
    @Published var selection: String
    @Published var shareURL: URL?
    @Published var showSplash = true

    /// The tab bar, and the role it was built for.
    ///
    /// This is the fix for an administrator who opened the app and found a
    /// single «Hours» tab — a site worker's bar — with the page itself
    /// correctly showing them as an administrator. The bar used to be a
    /// `static let` in `Config`, resolved once from a value remembered on the
    /// device, so whoever signed in first on a phone decided its shape for
    /// every account afterwards. Inside the shell the web app hides its own
    /// section rail, so that bar was the only navigation there was: the wrong
    /// bar is not a cosmetic problem, it is no way out.
    ///
    /// Seeded from the remembered role so the bar still exists before the first
    /// request completes, then rebuilt the moment a page reports a different
    /// account.
    @Published private(set) var tabs: [WebTab]
    private var tabsRole: String?

    private(set) var stores: [String: WebViewStore] = [:]
    private var signedInObserver: NSObjectProtocol?
    private var roleObserver: NSObjectProtocol?

    init() {
        let role = Config.erpRole
        let initial = NavManifest.load(role: role)
        self.tabsRole = role
        self.tabs = initial
        self.selection = initial.first?.id ?? "home"
        for tab in initial {
            stores[tab.id] = WebViewStore(tab: tab, tabCount: initial.count) { [weak self] url in
                self?.shareURL = url
            }
        }

        // Sign in once, not once per tab. Every tab shares the cookie store, so
        // the session was never per-tab — but a tab that loaded BEFORE sign-in
        // keeps showing its own login page until something reloads it, and
        // nothing did. Whichever tab completes the sign-in says so, and the rest
        // refresh themselves. Each ignores this unless it is itself sitting on
        // the login page, so a tab holding real work is never disturbed.
        signedInObserver = NotificationCenter.default.addObserver(
            forName: .caneiSignedIn, object: nil, queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                self?.stores.values.forEach { $0.reloadIfShowingLogin() }
            }
        }

        // A page has told us who it is signed in as. If that is not who the bar
        // was built for, the bar is wrong — rebuild it now rather than at some
        // later launch nobody is going to perform.
        roleObserver = NotificationCenter.default.addObserver(
            forName: .caneiRoleChanged, object: nil, queue: .main
        ) { [weak self] note in
            let role = note.userInfo?["role"] as? String
            Task { @MainActor in self?.applyRole(role) }
        }
    }

    /// Rebuild the tab bar for the account that is signed in now.
    ///
    /// Every page in the shell reports its role on load, so this is called
    /// repeatedly with the same answer; it does nothing unless the answer has
    /// actually moved.
    ///
    /// When it has moved, the open pages belong to the previous account, so
    /// they go with it. Keeping them would mean an administrator arriving at
    /// six tabs of somebody else's screens — and the pages reload themselves
    /// under the new session anyway, so dropping them buys correctness for a
    /// cost that was already being paid.
    func applyRole(_ role: String?) {
        let next = (role?.isEmpty ?? true) ? nil : role
        guard next != tabsRole else { return }
        tabsRole = next
        Config.erpRole = next

        let bar = NavManifest.load(role: next)
        guard bar.map(\.id) != tabs.map(\.id) else { return }

        stores.removeAll()
        tabs = bar
        if !bar.contains(where: { $0.id == selection }) {
            selection = bar.first?.id ?? selection
        }
    }

    // No deinit removing the observer, deliberately. AppState is the app's
    // root @StateObject and lives for the whole process, so a deinit here would
    // never run — and reaching main-actor state from a nonisolated deinit is
    // exactly the kind of thing that fails to compile on a CI toolchain I
    // cannot exercise from here. Nothing to gain, a build to lose.

    /// Called when a tab is chosen. Covers the case the broadcast cannot: a
    /// session that expired while the app was in the background, where the tab
    /// being opened is stale but no sign-in has happened to announce.
    func didSelect(_ id: String) {
        store(for: id).reloadIfShowingLogin()
        // Who is signed in may have changed in ANOTHER tab since this one was
        // last looked at — these web views are long-lived and independent. Ask
        // before showing it; the page reloads itself if the answer moved.
        store(for: id).recheckSession()
        // Match the web: a section tap opens that section's panel. The shell's
        // tabs are the web's section bar, so they owe the same answer.
        store(for: id).openSection(id)
    }

    /// The web view for a tab, created on demand.
    ///
    /// On demand is the normal path now, not a safety net: `applyRole` drops
    /// every store when the account changes, and the bar it hands SwiftUI may
    /// contain tabs that have never been opened on this launch.
    func store(for id: String) -> WebViewStore {
        if let s = stores[id] { return s }
        guard let tab = tabs.first(where: { $0.id == id }) ?? tabs.first else {
            // A bar with no tabs cannot happen — `NavManifest.load` falls back
            // to the full set rather than to nothing — but the language has to
            // be told that, and a crash here would be a blank app.
            let fallback = NavManifest.load(role: nil)
            let s = WebViewStore(tab: fallback[0], tabCount: fallback.count) { [weak self] url in
                self?.shareURL = url
            }
            stores[id] = s
            return s
        }
        let s = WebViewStore(tab: tab, tabCount: tabs.count) { [weak self] url in
            self?.shareURL = url
        }
        stores[id] = s
        return s
    }

    /// Dismiss the splash after the first page has painted (or a short timeout),
    /// whichever comes first — never leave the user staring at a splash.
    func scheduleSplashDismiss() {
        Task { @MainActor in
            let first = store(for: selection)
            // Poll briefly for first paint.
            for _ in 0..<24 { // ~2.4s max
                if first.didFinishFirstLoad { break }
                try? await Task.sleep(nanoseconds: 100_000_000)
            }
            withAnimation(.easeInOut(duration: 0.45)) { showSplash = false }
        }
    }
}
