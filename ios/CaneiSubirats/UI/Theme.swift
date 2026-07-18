import SwiftUI

/// Brand design tokens — a 1:1 mirror of the web app's CSS custom properties
/// (see `site/index.html :root`). Keeping the native palette identical to the
/// web palette means the shell and the content read as one continuous product.
enum Theme {

    // MARK: Brand palette (from the web app)
    static let green      = Color(hex: 0x48733C) // --green
    static let greenLt    = Color(hex: 0x6BA85A) // --greenLt
    static let greenDeep  = Color(hex: 0x31532A) // --greenDeep
    static let greenSoft  = Color(hex: 0xE7F0E1) // --greenSoft
    static let greenPale  = Color(hex: 0xDCE8D4) // --greenPale
    static let spark      = Color(hex: 0xF2C230) // --spark (gold)

    static let ink        = Color(hex: 0x14160F) // --ink
    static let body       = Color(hex: 0x4F5347) // --body
    static let muted      = Color(hex: 0x8B8F80) // --muted
    static let faint      = Color(hex: 0xAAB0A0) // --faint

    static let line       = Color(hex: 0xDDE5D6) // --line
    static let hair       = Color(hex: 0xE7EEE1) // --hair
    static let bg         = Color(hex: 0xEEF3EA) // --bg
    static let paper      = Color.white          // --paper

    /// Vertical brand gradient used on the splash and top bar.
    static let brandGradient = LinearGradient(
        colors: [greenDeep, green],
        startPoint: .top,
        endPoint: .bottom
    )

    /// A soft, premium page background wash.
    static let pageGradient = LinearGradient(
        colors: [bg, greenSoft],
        startPoint: .top,
        endPoint: .bottom
    )

    // MARK: Typography — matches the web app's Inter / Roboto Serif pairing,
    // falling back to the system fonts so no font files need bundling.
    static func serif(_ size: CGFloat, weight: Font.Weight = .semibold) -> Font {
        .system(size: size, weight: weight, design: .serif)
    }
    static func sans(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        .system(size: size, weight: weight, design: .default)
    }

    // MARK: Metrics
    static let corner: CGFloat = 16
    static let hairline: CGFloat = 1
}

extension Color {
    /// Build a Color from a 24-bit RGB hex literal, e.g. `Color(hex: 0x48733C)`.
    init(hex: UInt32, alpha: Double = 1.0) {
        let r = Double((hex >> 16) & 0xFF) / 255.0
        let g = Double((hex >> 8) & 0xFF) / 255.0
        let b = Double(hex & 0xFF) / 255.0
        self.init(.sRGB, red: r, green: g, blue: b, opacity: alpha)
    }
}

extension UIColor {
    convenience init(hex: UInt32, alpha: CGFloat = 1.0) {
        let r = CGFloat((hex >> 16) & 0xFF) / 255.0
        let g = CGFloat((hex >> 8) & 0xFF) / 255.0
        let b = CGFloat(hex & 0xFF) / 255.0
        self.init(red: r, green: g, blue: b, alpha: alpha)
    }
}
