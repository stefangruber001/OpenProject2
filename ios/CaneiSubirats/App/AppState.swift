import SwiftUI
import Combine

/// App-wide state: owns one long-lived `WebViewStore` per tab (so pages keep
/// their state when you switch tabs), the current selection, and the item to
/// present in the share sheet.
@MainActor
final class AppState: ObservableObject {
    @Published var selection: String
    @Published var shareURL: URL?
    @Published var showSplash = true

    private(set) var stores: [String: WebViewStore] = [:]

    init() {
        self.selection = Config.tabs.first?.id ?? "home"
        for tab in Config.tabs {
            stores[tab.id] = WebViewStore(tab: tab) { [weak self] url in
                self?.shareURL = url
            }
        }
    }

    func store(for id: String) -> WebViewStore {
        if let s = stores[id] { return s }
        // Fallback (should never happen): synthesize on demand.
        let tab = Config.tabs.first(where: { $0.id == id }) ?? Config.tabs[0]
        let s = WebViewStore(tab: tab) { [weak self] url in self?.shareURL = url }
        stores[id] = s
        return s
    }

    /// Dismiss the splash after the first page has painted (or a short timeout),
    /// whichever comes first — never leave the user staring at a splash.
    func scheduleSplashDismiss() {
        Task { @MainActor in
            let first = store(for: selection)
            // Poll briefly for first paint.
            for _ in 0..<24 { // ~2.4s max
                if first.didFinishFirstLoad { break }
                try? await Task.sleep(nanoseconds: 100_000_000)
            }
            withAnimation(.easeInOut(duration: 0.45)) { showSplash = false }
        }
    }
}
