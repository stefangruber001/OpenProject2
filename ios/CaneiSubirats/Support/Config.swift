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
    /// detect it is running inside the native shell (e.g. to hide its own top
    /// chrome, enable haptics, or use the native share sheet).
    static let userAgentMarker = "CaneiApp/1.0 (iOS; native-shell)"

    /// The tabs of the app. Each maps to a page of the web app.
    /// Reordering / renaming here restyles the whole app without touching views.
    static let tabs: [WebTab] = [
        WebTab(id: "home",
               title: "Home",
               systemImage: "house.fill",
               path: "index.html"),
        WebTab(id: "project",
               title: "Project",
               systemImage: "square.stack.3d.up.fill",
               path: "journey.html"),
        WebTab(id: "clients",
               title: "Clients",
               systemImage: "person.2.fill",
               path: "clientes.html"),
        WebTab(id: "tower",
               title: "Control Tower",
               systemImage: "chart.bar.xaxis.ascending",
               path: "dashboard.html"),
        WebTab(id: "master",
               title: "Master",
               systemImage: "square.grid.2x2.fill",
               path: "master-data.html"),
        WebTab(id: "finance",
               title: "Finance",
               systemImage: "eurosign.circle.fill",
               path: "financial-data.html"),
        WebTab(id: "guide",
               title: "Guide",
               systemImage: "book.closed.fill",
               path: "setup-guide.html")
    ]

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
