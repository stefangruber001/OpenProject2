import SwiftUI

/// Premium launch experience: the brand mark scales in over a brand-gradient
/// field, then the whole splash lifts away. Designed to feel like the app is
/// "opening" rather than merely appearing.
struct SplashView: View {
    @State private var markScale: CGFloat = 0.6
    @State private var markOpacity: Double = 0
    @State private var wordmarkOffset: CGFloat = 12
    @State private var wordmarkOpacity: Double = 0

    var body: some View {
        ZStack {
            Theme.brandGradient.ignoresSafeArea()

            // Subtle radial glow behind the mark.
            RadialGradient(colors: [Theme.greenLt.opacity(0.35), .clear],
                           center: .center, startRadius: 0, endRadius: 260)
                .ignoresSafeArea()

            VStack(spacing: 22) {
                BrandMark(size: 92)
                    .scaleEffect(markScale)
                    .opacity(markOpacity)
                    .shadow(color: .black.opacity(0.25), radius: 24, y: 12)

                VStack(spacing: 6) {
                    Text(Config.appName)
                        .font(Theme.serif(30, weight: .semibold))
                        .foregroundStyle(.white)
                    Text(Config.appTagline.uppercased())
                        .font(Theme.sans(12, weight: .semibold))
                        .tracking(2.4)
                        .foregroundStyle(.white.opacity(0.72))
                }
                .offset(y: wordmarkOffset)
                .opacity(wordmarkOpacity)
            }
        }
        .onAppear {
            withAnimation(.spring(response: 0.6, dampingFraction: 0.7)) {
                markScale = 1.0
                markOpacity = 1.0
            }
            withAnimation(.easeOut(duration: 0.5).delay(0.22)) {
                wordmarkOffset = 0
                wordmarkOpacity = 1.0
            }
        }
    }
}
