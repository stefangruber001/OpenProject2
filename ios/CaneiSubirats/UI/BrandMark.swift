import SwiftUI

/// The Canei Subirats brand mark, drawn in pure SwiftUI so it is crisp at any
/// size and needs no bundled image. A rounded "house/keystone" glyph in the
/// brand green with a gold spark — the same visual language as the web app.
struct BrandMark: View {
    var size: CGFloat = 64
    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: size * 0.28, style: .continuous)
                .fill(Theme.brandGradient)
                .overlay(
                    RoundedRectangle(cornerRadius: size * 0.28, style: .continuous)
                        .strokeBorder(.white.opacity(0.10), lineWidth: 1)
                )
            // A stylised roof / keystone.
            CaneiGlyph()
                .fill(.white)
                .frame(width: size * 0.5, height: size * 0.5)
            // Gold spark.
            Circle()
                .fill(Theme.spark)
                .frame(width: size * 0.14, height: size * 0.14)
                .offset(x: size * 0.20, y: -size * 0.20)
        }
        .frame(width: size, height: size)
    }
}

/// A minimal roofline glyph: a triangular roof over an open base — reads as
/// "reformas / building" at a glance.
struct CaneiGlyph: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        let w = rect.width, h = rect.height
        // Roof
        p.move(to: CGPoint(x: w * 0.5, y: 0))
        p.addLine(to: CGPoint(x: w, y: h * 0.42))
        p.addLine(to: CGPoint(x: w * 0.82, y: h * 0.42))
        p.addLine(to: CGPoint(x: w * 0.5, y: h * 0.18))
        p.addLine(to: CGPoint(x: w * 0.18, y: h * 0.42))
        p.addLine(to: CGPoint(x: 0, y: h * 0.42))
        p.closeSubpath()
        // Two pillars
        p.addRect(CGRect(x: w * 0.20, y: h * 0.52, width: w * 0.16, height: h * 0.48))
        p.addRect(CGRect(x: w * 0.64, y: h * 0.52, width: w * 0.16, height: h * 0.48))
        return p
    }
}
