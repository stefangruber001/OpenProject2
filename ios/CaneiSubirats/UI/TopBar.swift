import SwiftUI

/// A slim, premium top bar that sits above each web page. It carries the tab
/// title, a contextual back control (visible only when the web view can go
/// back), a thin determinate progress line, and a share action. A translucent
/// material keeps content readable while feeling light and modern.
struct TopBar: View {
    let title: String
    let canGoBack: Bool
    let isLoading: Bool
    let progress: Double
    let onBack: () -> Void
    let onShare: () -> Void
    let onReload: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                if canGoBack {
                    barButton(system: "chevron.left", label: "Back") { Haptics.light(); onBack() }
                        .transition(.move(edge: .leading).combined(with: .opacity))
                }

                HStack(spacing: 9) {
                    BrandMark(size: 26)
                    Text(title)
                        .font(Theme.serif(19, weight: .semibold))
                        .foregroundStyle(Theme.ink)
                        .lineLimit(1)
                }
                .accessibilityElement(children: .combine)
                .accessibilityAddTraits(.isHeader)

                Spacer(minLength: 8)

                barButton(system: "arrow.clockwise", label: "Reload") { Haptics.light(); onReload() }
                barButton(system: "square.and.arrow.up", label: "Share") { Haptics.light(); onShare() }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .frame(maxWidth: .infinity)

            // Determinate progress hairline.
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Theme.hair
                    Rectangle()
                        .fill(Theme.green)
                        .frame(width: geo.size.width * CGFloat(isLoading ? max(0.04, progress) : 1))
                        .opacity(isLoading ? 1 : 0)
                        .animation(.easeOut(duration: 0.25), value: progress)
                        .animation(.easeOut(duration: 0.3), value: isLoading)
                }
            }
            .frame(height: isLoading ? 2 : 0.5)
        }
        .background(
            .regularMaterial,
            in: Rectangle()
        )
        .overlay(alignment: .bottom) {
            if !isLoading {
                Rectangle().fill(Theme.line).frame(height: 0.5)
            }
        }
        .animation(.spring(response: 0.35, dampingFraction: 0.85), value: canGoBack)
    }

    private func barButton(system: String, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: system)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Theme.green)
                .frame(width: 38, height: 38)
                .background(Circle().fill(Theme.greenSoft))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }
}
