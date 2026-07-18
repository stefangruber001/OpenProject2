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
            ForEach(Config.tabs) { tab in
                WebContainerView(store: app.store(for: tab.id)) { url in
                    app.shareURL = url
                }
                .opacity(app.selection == tab.id ? 1 : 0)
                .allowsHitTesting(app.selection == tab.id)
                .zIndex(app.selection == tab.id ? 1 : 0)
            }

            // Bottom tab bar pinned to the safe area.
            VStack(spacing: 0) {
                Spacer()
                TabBar(tabs: Config.tabs, selection: $app.selection) { id in
                    // Re-tapping the active tab returns it to its home page.
                    app.store(for: id).goHome()
                }
            }
            .ignoresSafeArea(.keyboard)

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
            ShareSheet(items: [item.url])
                .presentationDetents([.medium, .large])
        }
        .preferredColorScheme(.light) // brand is a light, premium theme
    }
}

private struct ShareItem: Identifiable {
    let url: URL
    var id: String { url.absoluteString }
}
