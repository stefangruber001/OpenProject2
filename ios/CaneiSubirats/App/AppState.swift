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

    private(set) var stores: [String: WebViewStore] = [:]
    private var signedInObserver: NSObjectProtocol?

    init() {
        self.selection = Config.tabs.first?.id ?? "home"
        for tab in Config.tabs {
            stores[tab.id] = WebViewStore(tab: tab) { [weak self] url in
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
        // Match the web: a section tap opens that section's panel. The shell's
        // tabs are the web's section bar, so they owe the same answer.
        store(for: id).openSection(id)
    }

    func store(for id: String) -> WebViewStore {
        if let s = stores[id] { return s }
        // Fallback (should never happen): synthesize on demand.
        let tab = Config.tabs.first(where: { $0.id == id }) ?? Config.tabs[0]
        let s = WebViewStore(tab: tab) { [weak self] url in self?.shareURL = url }
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
