import Foundation

/// A single destination in the app. Declared as data in `Config.tabs` so the
/// navigation is driven by configuration, mirroring the web app's own
/// data-driven approach.
struct WebTab: Identifiable, Hashable {
    let id: String
    let title: String
    /// SF Symbol name for the tab bar.
    let systemImage: String
    /// Path relative to `Config.baseURL`.
    let path: String

    /// Resolved against `Config.baseURL` **as a URL**, not as a path component.
    ///
    /// `appendingPathComponent` treats its argument as one whole path segment,
    /// so it percent-encodes anything illegal in a segment — including `#`. The
    /// tabs address the ERP shell's sections by fragment (`erp.html#tower`), so
    /// that call turned every one of them into a request for a file literally
    /// named `erp.html#tower`:
    ///
    ///     /workspace/erp.html%23tower  → 404
    ///     /workspace/erp.html          → 200, shell opens #tower itself
    ///
    /// It shipped that way in 1.1: the tabs used to point at standalone pages,
    /// no `#` in any of them, and the encoding had nothing to bite on. The
    /// session that moved them onto the shell's hash routes introduced the
    /// first fragment and every tab but Guide — the one page still without a
    /// `#` — answered 404 against a completely healthy server. A fragment is
    /// for the client and is never sent to the server at all, which is exactly
    /// what `URL(string:relativeTo:)` knows and `appendingPathComponent` does
    /// not.
    var url: URL {
        // `.absoluteURL` because a relative URL's `.absoluteString` is fine but
        // WKWebView is handed the URL itself; resolving here keeps the base out
        // of every caller.
        URL(string: path, relativeTo: Config.baseURL)?.absoluteURL
            // Unparseable means a typo in `Config.tabs`, which no operator can
            // act on. The workspace root is a real screen; re-encoding the way
            // that caused this is not a fallback, it is the bug again.
            ?? Config.baseURL
    }
}
