import SwiftUI

/// One tab's screen: the live web view and a graceful offline state.
///
/// There is deliberately NO native top bar. The workspace draws its own header
/// — the Canei Subirats mark, the global search, «＋ Crear», the bell — and a
/// native bar above it meant two headers stacked on a phone, one of them a
/// second brand mark saying the tab's name. The operator's words: "Why is in
/// the app a new header above Canei Subirats, remove it again. Means Canei
/// Subirats stays always there but if you click on that logo it brings you back
/// to tower always." Which is now what it does, in the web app itself, on every
/// surface — phone, tablet and desktop — rather than only in the shell.
///
/// What the removed bar carried, and where each capability went:
///   · back        — `allowsBackForwardNavigationGestures` is on, so the edge
///                   swipe already did this and still does.
///   · reload      — pull-to-refresh, wired in `WebView`, already did this.
///   · share       — still reachable: the page can call the `share` bridge
///                   action, which `WebViewStore.handleBridge` forwards to the
///                   system share sheet. There is no longer a native BUTTON for
///                   it; if one is wanted it belongs in the web header, beside
///                   the other global actions, not in a second bar.
///   · progress    — the web app has its own loading state, and pull-to-refresh
///                   shows a spinner.
struct WebContainerView: View {
    @ObservedObject var store: WebViewStore

    var body: some View {
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
        .background(Theme.bg)
    }
}
