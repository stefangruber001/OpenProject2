import SwiftUI

/// The app's root: a persistent stack of tab screens (all kept alive so state
/// survives switching), the custom floating tab bar, the launch splash, and the
/// share sheet host.
struct RootView: View {
    @StateObject private var app = AppState()
    /// The Face ID gate. Owned here rather than inside `AppState` because it is
    /// about the device, not about the web content — and because the one thing
    /// it must never do is depend on a page having loaded.
    @StateObject private var lock = BiometricLock()
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        ZStack {
            Theme.bg.ignoresSafeArea()

            // Keep every tab's web view alive; show only the selected one.
            // Hidden tabs still load in the background for instant switching.
            ZStack {
                ForEach(Config.tabs) { tab in
                    WebContainerView(store: app.store(for: tab.id)) { url in
                        app.shareURL = url
                    }
                    .opacity(app.selection == tab.id ? 1 : 0)
                    .allowsHitTesting(app.selection == tab.id)
                    .zIndex(app.selection == tab.id ? 1 : 0)
                }
            }
            // The tab bar is a proper bottom safe-area inset, so the web content
            // is laid out ABOVE it (never hidden behind it) — the idiomatic,
            // best-in-class layout. It stays put when the keyboard appears.
            .safeAreaInset(edge: .bottom, spacing: 0) {
                TabBar(tabs: Config.tabs, selection: $app.selection) { id in
                    // Re-tapping the active tab scrolls it back to the top,
                    // preserving any in-progress page state.
                    app.store(for: id).scrollToTop()
                }
            }
            .ignoresSafeArea(.keyboard, edges: .bottom)
            // Every tab is loaded up front for instant switching (see above),
            // which means they all load BEFORE anyone has signed in. Opening one
            // that is still showing the login page refreshes it; a tab holding
            // real work is left alone.
            // The single-closure form on purpose: the deployment target is iOS
            // 16 (see IPHONEOS_DEPLOYMENT_TARGET), and `onChange(of:initial:_:)`
            // — the two-parameter variant — starts at iOS 17. It is deprecated
            // on newer systems but not unavailable, so this compiles for the
            // phones this app actually has to run on.
            .onChange(of: app.selection) { id in app.didSelect(id) }

            if app.showSplash {
                SplashView()
                    .transition(.opacity)
                    .zIndex(10)
            }

            // Above the splash, because on a normal launch the operator should
            // see one brand screen that turns into their work — not a splash
            // that finishes and is then replaced by a lock.
            if lock.isCovering {
                LockView(kind: lock.kind, phase: lock.phase) {
                    Task { await lock.authenticate() }
                }
                .transition(.opacity)
                .zIndex(20)
            } else if lock.shielded {
                PrivacyShield()
                    .transition(.opacity)
                    .zIndex(19)
            }
        }
        .onAppear { app.scheduleSplashDismiss() }
        // The launch trigger. `onChange` does not fire for the value a view
        // starts with, so without this the very first foreground — the cold
        // launch, the one that matters most — would never ask.
        .task { await lock.start() }
        .onChange(of: scenePhase) { phase in
            switch phase {
            case .active:
                Task { await lock.appDidBecomeActive() }
            case .inactive:
                // Covers the app-switcher snapshot, which iOS takes on the way
                // out, while the app is still `.inactive` rather than
                // `.background`. Waiting for `.background` photographs the data.
                lock.appWillResignActive()
            case .background:
                lock.appDidEnterBackground()
            @unknown default:
                break
            }
        }
        .sheet(item: Binding(
            get: { app.shareURL.map { ShareItem(url: $0) } },
            set: { app.shareURL = $0?.url }
        )) { item in
            // UIActivityViewController manages its own presentation.
            ShareSheet(items: [item.url])
        }
        .preferredColorScheme(.light) // brand is a light, premium theme
    }
}

private struct ShareItem: Identifiable {
    let url: URL
    var id: String { url.absoluteString }
}
