import UIKit

/// Thin wrapper over UIFeedbackGenerator so the whole app has one, consistent,
/// premium-feeling haptic vocabulary. Generators are prepared before use to
/// minimise latency (the detail that separates best-in-class apps).
enum Haptics {
    private static let selection = UISelectionFeedbackGenerator()
    private static let impactLight = UIImpactFeedbackGenerator(style: .light)
    private static let impactSoft = UIImpactFeedbackGenerator(style: .soft)
    private static let notification = UINotificationFeedbackGenerator()

    /// Light tick — used on tab switches and pull-to-refresh arm.
    static func tick() {
        selection.prepare()
        selection.selectionChanged()
    }

    static func light() {
        impactLight.prepare()
        impactLight.impactOccurred()
    }

    static func soft() {
        impactSoft.prepare()
        impactSoft.impactOccurred(intensity: 0.7)
    }

    static func success() {
        notification.prepare()
        notification.notificationOccurred(.success)
    }

    static func warning() {
        notification.prepare()
        notification.notificationOccurred(.warning)
    }
}
