import SwiftUI

/// One tab's screen: the premium top bar, the live web view, and a graceful
/// offline state — composed so the native chrome frames the web content.
struct WebContainerView: View {
    @ObservedObject var store: WebViewStore
    let onShare: (URL) -> Void

    var body: some View {
        VStack(spacing: 0) {
            TopBar(
                title: store.tab.title,
                canGoBack: store.canGoBack,
                isLoading: store.isLoading,
                progress: store.estimatedProgress,
                onBack: { store.goBack() },
                onShare: { onShare(store.webView.url ?? store.tab.url) },
                onReload: { store.reload() }
            )

            ZStack {
                Theme.bg.ignoresSafeArea(edges: .bottom)
                WebView(store: store)
                    .opacity(store.hasError ? 0 : 1)

                if store.hasError {
                    OfflineView { store.reload() }
                        .transition(.opacity)
                }
            }
            .animation(.easeInOut(duration: 0.25), value: store.hasError)
        }
        .background(Theme.bg)
    }
}
