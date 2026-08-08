import SwiftUI

/// The app's root: a persistent stack of tab screens (all kept alive so state
/// survives switching), the custom floating tab bar, the launch splash, and the
/// share sheet host.
struct RootView: View {
    @StateObject private var app = AppState()

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
            .onChange(of: app.selection) { _, id in app.didSelect(id) }

            if app.showSplash {
                SplashView()
                    .transition(.opacity)
                    .zIndex(10)
            }
        }
        .onAppear { app.scheduleSplashDismiss() }
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
