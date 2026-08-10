import Foundation

/// Single source of truth for what the app points at.
///
/// The app is a premium native shell around the **live** web app. Because every
/// screen is loaded from the web, anything that changes on the server flows into
/// the app on the next launch or pull-to-refresh — no App Store update required
/// for content or workflow changes.
enum Config {

    /// Base URL of the running ERP.
    ///
    /// This points at the SERVER, which is the only address where the company's
    /// data actually lives. It used to point at GitHub Pages, and that is worth
    /// understanding rather than just correcting: Pages serves a static copy of
    /// the same screens with no database behind them, so the app looked right
    /// and worked — every screen rendered, every form saved — while writing to
    /// storage inside the phone. A customer entered on a laptop was simply not
    /// there on the phone, and nothing reported an error, because from the
    /// app's point of view nothing had gone wrong. A shell around the wrong
    /// address is indistinguishable from a shell around the right one until
    /// somebody tries to share a record.
    ///
    /// The trailing `/workspace/` matters: the server serves the API at the
    /// root and the screens beneath that path.
    ///
    /// Changing this one line moves the whole app. When the real domain
    /// arrives, this is what changes — and only this, because `internalHosts`
    /// below is derived from it rather than repeated.
    static let baseURL = URL(string: "https://178-105-10-156.sslip.io/workspace/")!

    /// Marketing name shown in the splash and About.
    static let appName = "Canei Subirats"
    static let appTagline = "ERP for reformas"

    /// A short marker appended to the WKWebView user-agent so the web app can
    /// detect it is running inside the native shell.
    ///
    /// As of 1.1 the web app actually READS it. Until then nothing did, which
    /// meant a phone inside this app stacked three things at the bottom of the
    /// screen: the web app's own five-icon section bar, this app's floating tab
    /// bar over the top of it, and the web app's site-action button positioned
    /// to clear the bar that was no longer the one in front. Under the marker
    /// the web bar stands down — the native tab bar does that job — and the
    /// breadcrumb becomes the opener for the subsection list, which is the one
    /// thing a six-tab native bar cannot reach.
    ///
    /// The web app matches on `CaneiApp/` and not on the version, so an older
    /// build keeps working against a newer site. Keep the prefix.
    static let userAgentMarker = "CaneiApp/1.1 (iOS; native-shell)"

    /// The tabs of the app. Each maps to a page of the web app.
    /// Reordering / renaming here restyles the whole app without touching views.
    ///
    /// These now address the ERP shell's own sections by hash rather than the
    /// four standalone pages the app was born with. Those pages are redirect
    /// stubs today, so the old paths still worked — but through two hops, and
    /// landing on whichever screen the stub happened to point at rather than
    /// the one the tab is named after. The hashes are the v4 route keys.
    static let tabs: [WebTab] = [
        WebTab(id: "tower",
               title: "Tower",
               systemImage: "chart.bar.xaxis.ascending",
               path: "erp.html#tower"),
        WebTab(id: "project",
               title: "Projects",
               systemImage: "square.stack.3d.up.fill",
               path: "erp.html#progress"),
        WebTab(id: "sales",
               title: "Sales",
               systemImage: "person.2.fill",
               path: "erp.html#leads"),
        WebTab(id: "admin",
               title: "Admin",
               systemImage: "eurosign.circle.fill",
               path: "erp.html#invoicing"),
        WebTab(id: "master",
               title: "Master data",
               systemImage: "square.grid.2x2.fill",
               path: "erp.html#customers"),
        WebTab(id: "guide",
               title: "Guide",
               systemImage: "book.closed.fill",
               path: "setup-guide.html")
    ]

    /// Hosts that should open inside
    /// Hosts that should open inside the app's web views. Everything else
    /// (mailto, tel, external websites) is handed to the system.
    ///
    /// DERIVED from `baseURL`, not written out again. When this was a second
    /// hardcoded copy of the host, repointing the app meant editing two lines
    /// that look unrelated — and missing the second one sends every tab to
    /// Safari instead of the web view, which reads as "the app is broken"
    /// rather than "one constant is stale".
    static let internalHosts: Set<String> = Set([baseURL.host].compactMap { $0 })
}
