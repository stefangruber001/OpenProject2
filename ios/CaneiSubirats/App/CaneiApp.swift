import SwiftUI

/// App entry point. A single-window SwiftUI app whose content is a premium
/// native shell around the live, continuously-updated web app.
@main
struct CaneiApp: App {
    var body: some Scene {
        WindowGroup {
            RootView()
                .tint(Theme.green)
        }
    }
}
