import SwiftUI
import WebKit

/// SwiftUI bridge for the store's `WKWebView`, wiring up native pull-to-refresh.
struct WebView: UIViewRepresentable {
    @ObservedObject var store: WebViewStore

    func makeCoordinator() -> Coordinator { Coordinator(store: store) }

    func makeUIView(context: Context) -> WKWebView {
        let webView = store.webView

        // Native pull-to-refresh — reloads the live page from origin so the
        // latest published web app is fetched.
        let refresh = UIRefreshControl()
        refresh.tintColor = UIColor(hex: 0x48733C)
        refresh.addTarget(context.coordinator,
                          action: #selector(Coordinator.handleRefresh(_:)),
                          for: .valueChanged)
        webView.scrollView.refreshControl = refresh
        context.coordinator.refreshControl = refresh

        store.loadInitial()
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {
        // End the refresh spinner once loading completes.
        if !store.isLoading {
            context.coordinator.refreshControl?.endRefreshing()
        }
    }

    final class Coordinator: NSObject {
        let store: WebViewStore
        weak var refreshControl: UIRefreshControl?
        init(store: WebViewStore) { self.store = store }

        @objc func handleRefresh(_ sender: UIRefreshControl) {
            Haptics.tick()
            store.reload()
        }
    }
}
