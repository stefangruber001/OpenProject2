import SwiftUI

/// The screen the operator sees before the workspace.
///
/// It is deliberately the SAME field of brand green as `SplashView`, because on
/// a normal launch these two are one continuous moment: the app opens, the mark
/// settles, Face ID runs, a tick appears, the workspace is there. Two different
/// backgrounds would turn that into two screens with a seam down the middle.
///
/// The confirmation frame is the part that was asked for by name. iOS shows its
/// own tick inside the system sheet and then takes it away instantly, which
/// leaves the operator with an app that simply opened — no evidence of what
/// opened it. Holding a branded "Face ID verified" for three quarters of a
/// second is the difference between a door that swung open and a door somebody
/// unlocked for you.
struct LockView: View {
    let kind: BiometricLock.Kind
    let phase: BiometricLock.Phase
    let onUnlock: () -> Void

    @State private var pulse = false
    @State private var badgeScale: CGFloat = 1.0

    private var confirmed: Bool { phase == .confirmed }
    private var checking: Bool { phase == .checking }

    var body: some View {
        ZStack {
            Theme.brandGradient.ignoresSafeArea()

            RadialGradient(colors: [Theme.greenLt.opacity(0.35), .clear],
                           center: .center, startRadius: 0, endRadius: 280)
                .ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer(minLength: 0)

                BrandMark(size: 76)
                    .shadow(color: .black.opacity(0.25), radius: 22, y: 10)

                VStack(spacing: 6) {
                    Text(Config.appName)
                        .font(Theme.serif(26, weight: .semibold))
                        .foregroundStyle(.white)
                    Text(Config.appTagline.uppercased())
                        .font(Theme.sans(11, weight: .semibold))
                        .tracking(2.2)
                        .foregroundStyle(.white.opacity(0.66))
                }
                .padding(.top, 18)

                Spacer(minLength: 28)

                badge
                    .padding(.bottom, 18)

                Text(caption)
                    .font(Theme.sans(14.5, weight: .medium))
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.white.opacity(confirmed ? 0.95 : 0.78))
                    .frame(maxWidth: 280)
                    .animation(.easeInOut(duration: 0.25), value: caption)

                Spacer(minLength: 0)

                // Only offered when we are genuinely waiting on the operator. A
                // button under a system sheet that is already up would be a
                // second way to ask the same question.
                if case .locked = phase {
                    Button(action: onUnlock) {
                        Text(buttonTitle)
                            .font(Theme.sans(16, weight: .semibold))
                            .foregroundStyle(Theme.greenDeep)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 16)
                            .background(
                                RoundedRectangle(cornerRadius: 14, style: .continuous)
                                    .fill(.white)
                            )
                    }
                    .padding(.horizontal, 28)
                    .padding(.bottom, 12)
                    .transition(.opacity)
                }
            }
            .padding(.vertical, 44)
        }
        .animation(.easeInOut(duration: 0.3), value: checking)
        .onAppear { pulse = checking }
        // Single-closure `onChange` on purpose: the deployment target is iOS 16
        // and the two-parameter variant starts at iOS 17 (see RootView).
        .onChange(of: phase) { new in
            pulse = (new == .checking)
            if new == .confirmed {
                badgeScale = 0.82
                withAnimation(.spring(response: 0.42, dampingFraction: 0.6)) {
                    badgeScale = 1.0
                }
            }
        }
    }

    /// The sensor badge: the Face ID glyph while we wait, a gold tick once the
    /// phone has vouched for whoever is holding it.
    private var badge: some View {
        ZStack {
            Circle()
                .fill(confirmed ? Theme.spark : Color.white.opacity(0.14))
                .frame(width: 92, height: 92)
                .overlay(
                    Circle().strokeBorder(Color.white.opacity(confirmed ? 0 : 0.24), lineWidth: 1)
                )
                .shadow(color: confirmed ? Theme.spark.opacity(0.45) : .clear, radius: 22)

            Image(systemName: confirmed ? "checkmark" : kind.symbol)
                .font(.system(size: confirmed ? 38 : 42, weight: confirmed ? .bold : .light))
                .foregroundStyle(confirmed ? Theme.greenDeep : .white)
        }
        .scaleEffect(badgeScale * (pulse ? 1.05 : 1.0))
        .animation(
            pulse
                ? .easeInOut(duration: 0.95).repeatForever(autoreverses: true)
                : .easeInOut(duration: 0.25),
            value: pulse
        )
        .animation(.easeInOut(duration: 0.3), value: confirmed)
        .accessibilityLabel(caption)
    }

    private var caption: String {
        switch phase {
        case .confirmed:
            return kind == .passcode ? "Verified" : "\(kind.title) verified"
        case .checking:
            return kind == .passcode ? "Enter the device passcode" : "Checking \(kind.title)…"
        case .locked(let message):
            if let message = message { return message }
            return kind == .passcode
                ? "Enter the passcode to continue"
                : "Unlock with \(kind.title) to continue"
        case .open:
            return ""
        }
    }

    private var buttonTitle: String {
        kind == .passcode ? "Unlock" : "Unlock with \(kind.title)"
    }
}

/// What the app switcher photographs.
///
/// Not the lock screen — this appears and disappears in a fraction of a second
/// on every trip to another app, and running the lock screen's entrance
/// animation each time would look like a stutter. The brand mark on the brand
/// field, nothing else, no motion.
struct PrivacyShield: View {
    var body: some View {
        ZStack {
            Theme.brandGradient.ignoresSafeArea()
            BrandMark(size: 68)
                .shadow(color: .black.opacity(0.22), radius: 18, y: 8)
        }
    }
}
