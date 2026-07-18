import SwiftUI

/// Shown when a page fails to load (offline, DNS, server error). Premium, calm,
/// on-brand — never a raw WebKit error string.
struct OfflineView: View {
    let onRetry: () -> Void
    @State private var spin = false

    var body: some View {
        VStack(spacing: 18) {
            ZStack {
                Circle()
                    .fill(Theme.greenSoft)
                    .frame(width: 88, height: 88)
                Image(systemName: "wifi.slash")
                    .font(.system(size: 34, weight: .semibold))
                    .foregroundStyle(Theme.green)
            }

            VStack(spacing: 6) {
                Text("You're offline")
                    .font(Theme.serif(22, weight: .semibold))
                    .foregroundStyle(Theme.ink)
                Text("This app loads your live workspace from the web. Reconnect and try again — your saved projects stay on this device.")
                    .font(Theme.sans(15))
                    .foregroundStyle(Theme.body)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.horizontal, 8)
            }

            Button {
                Haptics.light()
                withAnimation(.easeInOut(duration: 0.6)) { spin.toggle() }
                onRetry()
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "arrow.clockwise")
                        .rotationEffect(.degrees(spin ? 360 : 0))
                    Text("Try again").fontWeight(.semibold)
                }
                .font(Theme.sans(16, weight: .semibold))
                .foregroundStyle(.white)
                .padding(.horizontal, 26)
                .padding(.vertical, 14)
                .background(Capsule().fill(Theme.green))
            }
            .buttonStyle(.plain)
        }
        .padding(28)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.pageGradient.ignoresSafeArea())
    }
}
