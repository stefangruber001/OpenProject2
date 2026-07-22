import Foundation

/// Single source of truth for what the app points at.
///
/// The app is a premium native shell around the **live** web app that is
/// published to GitHub Pages. Because every screen is loaded from the web,
/// anything that changes on the website flows into the app automatically on
/// the next launch or pull-to-refresh — no App Store update required for
/// content or workflow changes.
enum Config {

    /// Base URL of the deployed web app (GitHub Pages).
    /// Change this one value to point the app at staging vs production.
    ///
    /// TESTING: pointed at the **development preview** (`/preview/`), which is
    /// served from the dev branch. This way the TestFlight build auto-updates
    /// with whatever we push to the dev branch — no App Store update needed.
    /// Flip to the production root for the public release:
    ///   static let baseURL = URL(string: "https://stefangruber001.github.io/OpenProject2/")!
    static let baseURL = URL(string: "https://stefangruber001.github.io/OpenProject2/preview/")!

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
    static let internalHosts: Set<String> = ["stefangruber001.github.io"]
}
