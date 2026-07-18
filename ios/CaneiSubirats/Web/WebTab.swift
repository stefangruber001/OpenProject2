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

    var url: URL {
        Config.baseURL.appendingPathComponent(path)
    }
}
