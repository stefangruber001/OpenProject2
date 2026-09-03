import SwiftUI
import UIKit
import WebKit
import Combine
import Network

/// Owns a single long-lived `WKWebView` for one tab and publishes its state to
/// SwiftUI. Keeping the web view in an `ObservableObject` (created once) means
/// SwiftUI redraws never tear down and reload the page — scroll position,
/// in-page state and IndexedDB all survive tab switches, exactly like a
/// best-in-class native app.
@MainActor
extension Notification.Name {
    /// Posted by whichever tab completed a sign-in, so the rest stop showing
    /// their own stale copy of the login page.
    static let caneiSignedIn = Notification.Name("caneiSignedIn")
}

final class WebViewStore: NSObject, ObservableObject {

    /// True while this tab is displaying the sign-in page.
    ///
    /// Declared here rather than beside the navigation callbacks that maintain
    /// it, because those live in the `WKNavigationDelegate` extension and Swift
    /// does not allow stored properties in an extension.
    private(set) var showingLogin = false

    // Published UI state
    @Published var isLoading = false
    @Published var estimatedProgress: Double = 0
    @Published var canGoBack = false
    @Published var canGoForward = false
    @Published var hasError = false
    @Published var pageTitle = ""
    @Published var didFinishFirstLoad = false

    let tab: WebTab
    let webView: WKWebView

    private var observers: [NSKeyValueObservation] = []
    private let onShare: (URL) -> Void
    /// Maps an in-flight download to the temp file it is being written to, so we
    /// can hand the finished file to the share sheet ("Save to Files", AirDrop…).
    private var downloadDestinations: [WKDownload: URL] = [:]
    /// Watches connectivity so the offline screen recovers itself the moment
    /// signal returns — essential on a job site that drops in and out of range.
    private let netMonitor = NWPathMonitor()

    init(tab: WebTab, onShare: @escaping (URL) -> Void) {
        self.tab = tab
        self.onShare = onShare

        // Shared, persistent data store so cookies / localStorage / IndexedDB
        // (the web app's project workspace) persist across launches, and are
        // shared across all tabs of the app.
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.defaultWebpagePreferences.allowsContentJavaScript = true

        // Native ⇄ web bridge (haptics, share, …).
        let contentController = WKUserContentController()
        config.userContentController = contentController

        // Mark the document as running inside the native shell as early as
        // possible (before first paint) so any `.native-app` CSS applies without
        // a flash of the web chrome.
        let markScript = WKUserScript(
            source: "document.documentElement.classList.add('native-app');",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        )
        contentController.addUserScript(markScript)

        // The app already provides a premium native top bar and tab bar, so we
        // collapse the web page's own brand header inside the shell to avoid a
        // duplicated header. Injected from the app so the website stays a clean,
        // standalone product and this presentation lives in one place.
        let chromeStyle = """
        (function(){
          var css = "html.native-app header.top,html.native-app .site-logo,"
                  + "html.native-app > body > .wrap > .logo:first-child{"
                  + "display:none !important}"
                  + "html.native-app, html.native-app body{background:#eef3ea}";
          var s = document.createElement('style');
          s.setAttribute('data-native-shell','1');
          s.textContent = css;
          (document.head || document.documentElement).appendChild(s);
        })();
        """
        let chromeScript = WKUserScript(
            source: chromeStyle,
            injectionTime: .atDocumentEnd,
            forMainFrameOnly: true
        )
        contentController.addUserScript(chromeScript)

        self.webView = WKWebView(frame: .zero, configuration: config)
        super.init()

        contentController.add(MessageProxy(self), name: "native")

        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        webView.allowsLinkPreview = true
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.isOpaque = false
        webView.backgroundColor = UIColor(hex: 0xEEF3EA)
        webView.scrollView.backgroundColor = UIColor(hex: 0xEEF3EA)
        webView.scrollView.showsHorizontalScrollIndicator = false

        // Append our marker to the default user agent.
        webView.evaluateJavaScript("navigator.userAgent") { [weak self] result, _ in
            if let ua = result as? String {
                self?.webView.customUserAgent = ua + " " + Config.userAgentMarker
            }
        }

        setupObservers()
        startNetworkMonitor()
    }

    deinit {
        netMonitor.cancel()
    }

    private func startNetworkMonitor() {
        netMonitor.pathUpdateHandler = { [weak self] path in
            guard path.status == .satisfied else { return }
            Task { @MainActor in
                guard let self, self.hasError else { return }
                self.reload()
            }
        }
        netMonitor.start(queue: DispatchQueue(label: "com.caneisubirats.erp.net"))
    }

    private func setupObservers() {
        // Capture only the Sendable new value (not the WKWebView) into the
        // main-actor hop, so this is clean under strict concurrency / Swift 6.
        observers = [
            webView.observe(\.estimatedProgress, options: [.new]) { [weak self] _, change in
                guard let value = change.newValue else { return }
                Task { @MainActor in self?.estimatedProgress = value }
            },
            webView.observe(\.isLoading, options: [.new]) { [weak self] _, change in
                guard let value = change.newValue else { return }
                Task { @MainActor in self?.isLoading = value }
            },
            webView.observe(\.canGoBack, options: [.new]) { [weak self] _, change in
                guard let value = change.newValue else { return }
                Task { @MainActor in self?.canGoBack = value }
            },
            webView.observe(\.canGoForward, options: [.new]) { [weak self] _, change in
                guard let value = change.newValue else { return }
                Task { @MainActor in self?.canGoForward = value }
            },
            webView.observe(\.title, options: [.new]) { [weak self] _, change in
                let value = (change.newValue ?? nil) ?? ""
                Task { @MainActor in self?.pageTitle = value }
            }
        ]
    }

    // MARK: Actions
    func loadInitial() {
        guard webView.url == nil else { return }
        load(tab.url)
    }

    func load(_ url: URL) {
        hasError = false
        var request = URLRequest(url: url)
        request.cachePolicy = .useProtocolCachePolicy
        webView.load(request)
    }

    func reload() {
        hasError = false
        if webView.url == nil {
            load(tab.url)
        } else {
            webView.reloadFromOrigin()
        }
    }

    func goBack() {
        if webView.canGoBack { webView.goBack() }
    }

    /// Return to the tab's home page.
    func goHome() {
        load(tab.url)
    }

    /// Smoothly scroll the current page to the top. Used when the already-active
    /// tab is tapped again — the best-in-class behaviour that preserves in-page
    /// state (never nukes a half-filled form with a reload).
    func scrollToTop() {
        let top = CGPoint(x: 0, y: -webView.scrollView.adjustedContentInset.top)
        webView.scrollView.setContentOffset(top, animated: true)
    }

    fileprivate func handleBridge(_ body: Any) {
        guard let dict = body as? [String: Any],
              let action = dict["action"] as? String else { return }
        switch action {
        case "haptic":
            switch dict["type"] as? String {
            case "success": Haptics.success()
            case "warning": Haptics.warning()
            case "soft":    Haptics.soft()
            default:        Haptics.light()
            }
        case "share":
            if let s = dict["url"] as? String, let u = URL(string: s) {
                onShare(u)
            } else if let u = webView.url {
                onShare(u)
            }
        default:
            break
        }
    }
}

// MARK: - Navigation
extension WebViewStore: WKNavigationDelegate {

    func webView(_ webView: WKWebView,
                 decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {

        guard let url = navigationAction.request.url else {
            decisionHandler(.allow); return
        }

        // Anchor tags with a `download` attribute (the web app's ZIP / PDF /
        // .eml exports) → turn into a native download we can save or share.
        if navigationAction.shouldPerformDownload {
            decisionHandler(.download); return
        }

        // Non-web schemes (mailto, tel, sms, maps) → hand to the system.
        if let scheme = url.scheme, !["http", "https", "about", "blob", "data", "file"].contains(scheme) {
            UIApplication.shared.open(url)
            decisionHandler(.cancel)
            return
        }

        // Links that leave our site (or explicit target=_blank) open in the
        // system browser so the app never traps the user on a foreign page.
        if let host = url.host, !Config.internalHosts.contains(host) {
            UIApplication.shared.open(url)
            decisionHandler(.cancel)
            return
        }

        decisionHandler(.allow)
    }

    // Responses the web view can't render (e.g. an octet-stream export) become
    // downloads rather than a blank page.
    func webView(_ webView: WKWebView,
                 decidePolicyFor navigationResponse: WKNavigationResponse,
                 decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        decisionHandler(navigationResponse.canShowMIMEType ? .allow : .download)
    }

    func webView(_ webView: WKWebView,
                 navigationAction: WKNavigationAction,
                 didBecome download: WKDownload) {
        download.delegate = self
    }

    func webView(_ webView: WKWebView,
                 navigationResponse: WKNavigationResponse,
                 didBecome download: WKDownload) {
        download.delegate = self
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        hasError = false
        if !didFinishFirstLoad {
            didFinishFirstLoad = true
            Haptics.soft()
        }

        // ONE SIGN-IN FOR THE WHOLE APP.
        //
        // Each tab owns a long-lived web view so its page keeps state, and they
        // all share one cookie store — so the session was never actually
        // per-tab. What was per-tab was the STALE PAGE: every tab loads once,
        // and the ones that loaded before sign-in were left displaying their
        // own copy of the login screen forever, because `loadInitial()` will not
        // reload a view that already has a URL. The operator read that,
        // reasonably, as being asked to sign in seven times.
        //
        // So the moment any tab leaves the login page, the others are told. Each
        // reloads only if it is itself sitting on the login page, which makes
        // this cheap and idempotent: it cannot disturb a tab holding real work.
        let wasLogin = showingLogin
        showingLogin = Self.isLoginURL(webView.url)
        if wasLogin && !showingLogin {
            NotificationCenter.default.post(name: .caneiSignedIn, object: nil)
        }
    }

    static func isLoginURL(_ url: URL?) -> Bool {
        guard let path = url?.path else { return false }
        return path == "/login" || path.hasSuffix("/login")
    }

    /// Reload only if this tab is stuck on the sign-in page.
    ///
    /// `load(tab.url)`, not `reload()`. A tab sitting on the login page has
    /// `/login?next=…` as its current URL, so reloading asks for the login page
    /// again — which is precisely what it was already showing. The tab has to be
    /// sent back to its OWN page; the session cookie then carries it through.
    ///
    /// The server-side half of this matters more (an authenticated visitor to
    /// /login is now redirected onward), and either fix alone is enough. Both
    /// are here because they are each correct on their own terms, and because
    /// this one also covers a tab whose `next` was lost.
    func reloadIfShowingLogin() {
        guard showingLogin || webView.url == nil else { return }
        load(tab.url)
    }

    /// Ask the page to open this section's panel — the same white sheet the web
    /// shows when a section is tapped there.
    ///
    /// The shell keeps one web view per tab, each already parked on its
    /// section's landing screen, so selecting a tab navigates nothing and the
    /// page had no reason to open anything. Without this the app answered a tab
    /// tap with a screen where the web answers it with a choice of screens.
    ///
    /// Safe against an old page: `caneiOpenSection` is guarded on the JS side,
    /// so a shell newer than the server simply does nothing here. The id comes
    /// from the bundled manifest and is matched against the page's own section
    /// list before use, but it is still passed as a quoted literal with the two
    /// characters that could end that literal removed — an injection through a
    /// file we ship ourselves is not the point; not building a string that can
    /// break the expression is.
    func openSection(_ id: String) {
        call("caneiOpenSection", id)
    }

    /// Open the section sheet, or dismiss it if it is already showing. Bound to
    /// a re-tap of the active tab, where the same gesture has to do both.
    func toggleSection(_ id: String) {
        call("caneiToggleSection", id)
    }

    /// One place that builds these calls, so the escaping rule is stated once.
    /// The id comes from the bundled manifest and the page checks it against
    /// its own section list before use, but it is still stripped to letters,
    /// digits, `-` and `_` here: the point is not to defend against a file we
    /// ship ourselves, it is never to build a string that can break out of the
    /// expression. A page older than the shell simply does nothing — both
    /// names are guarded on the JS side.
    private func call(_ fn: String, _ id: String) {
        let safe = id.filter { $0.isLetter || $0.isNumber || $0 == "-" || $0 == "_" }
        guard !safe.isEmpty else { return }
        webView.evaluateJavaScript("window.\(fn) && window.\(fn)('\(safe)')", completionHandler: nil)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        showErrorIfNeeded(error)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        showErrorIfNeeded(error)
    }

    private func showErrorIfNeeded(_ error: Error) {
        let ns = error as NSError
        // -999 = request cancelled (e.g. rapid reload) — not a real failure.
        guard ns.code != NSURLErrorCancelled else { return }
        hasError = true
        Haptics.warning()
    }

    // If the web content process is jettisoned under memory pressure, reload so
    // the user never lands on a blank white page — a hallmark of a robust shell.
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        webView.reloadFromOrigin()
    }
}

// MARK: - UI delegate (target=_blank, new windows)
extension WebViewStore: WKUIDelegate {
    func webView(_ webView: WKWebView,
                 createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction,
                 windowFeatures: WKWindowFeatures) -> WKWebView? {
        // target=_blank: load in the same web view if same-site, else system.
        if let url = navigationAction.request.url {
            if let host = url.host, Config.internalHosts.contains(host) {
                webView.load(navigationAction.request)
            } else {
                UIApplication.shared.open(url)
            }
        }
        return nil
    }
}

// MARK: - Downloads (exports: ZIP project folder, PDFs, .eml drafts)
extension WebViewStore: WKDownloadDelegate {
    func download(_ download: WKDownload,
                  decideDestinationUsing response: URLResponse,
                  suggestedFilename: String,
                  completionHandler: @escaping (URL?) -> Void) {
        let dir = FileManager.default.temporaryDirectory
            .appendingPathComponent("exports/\(UUID().uuidString)", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let name = suggestedFilename.isEmpty ? "Canei-export" : suggestedFilename
        let dest = dir.appendingPathComponent(name)
        downloadDestinations[download] = dest
        completionHandler(dest)
    }

    func downloadDidFinish(_ download: WKDownload) {
        guard let url = downloadDestinations.removeValue(forKey: download) else { return }
        Haptics.success()
        // Present the native share sheet so the user can Save to Files, AirDrop,
        // or send the exported document straight from the app.
        onShare(url)
    }

    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        downloadDestinations.removeValue(forKey: download)
        Haptics.warning()
    }
}

/// Weak proxy so the message handler does not retain the store (avoids a
/// retain cycle through WKUserContentController).
private final class MessageProxy: NSObject, WKScriptMessageHandler {
    weak var store: WebViewStore?
    init(_ store: WebViewStore) { self.store = store }
    func userContentController(_ userContentController: WKUserContentController,
                               didReceive message: WKScriptMessage) {
        // Script-message callbacks arrive on the main thread; assert that so we
        // can touch the main-actor store synchronously without a Sendable hop.
        let body = message.body
        MainActor.assumeIsolated { self.store?.handleBridge(body) }
    }
}
