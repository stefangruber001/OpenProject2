import SwiftUI
import UIKit
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

        // NOT `store.loadInitial()` HERE ANY MORE.
        //
        // Every tab's web view is built at launch — that is what makes
        // switching instant — and each one used to fetch its page immediately.
        // Before anybody has signed in, every one of those fetches is redirected
        // to the sign-in screen, so the app opened as SIX TABS EACH SHOWING A
        // LOGIN PAGE and not one of them showing what its tab is named after.
        // "The app did not load content on any tab" is a fair description of
        // that, and it is what App Review wrote.
        //
        // Loading is now driven by `AppState`: the selected tab loads, and the
        // rest load when they are first selected or when a sign-in completes.
        // Nothing is lost — `reloadIfShowingLogin` already loads a tab whose
        // view has no URL yet, and that is exactly what the sign-in broadcast
        // calls on every tab.
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
            // Fires on the main thread; assert it so the main-actor store call is
            // synchronous and clean under strict concurrency.
            Haptics.tick()
            MainActor.assumeIsolated { store.reload() }
        }
    }
}
