import SwiftUI

/// A custom, floating tab bar with a translucent material, an animated gold
/// selection pill, SF Symbols and haptics. Chosen over the stock `TabView` bar
/// for the premium, brand-tuned feel and precise control of motion.
struct TabBar: View {
    let tabs: [WebTab]
    @Binding var selection: String
    /// Fires when the already-selected tab is tapped again (scroll-to-home).
    let onReselect: (String) -> Void

    @Namespace private var pill

    var body: some View {
        HStack(spacing: 4) {
            ForEach(tabs) { tab in
                let isSelected = tab.id == selection
                Button {
                    if isSelected {
                        Haptics.soft()
                        onReselect(tab.id)
                    } else {
                        Haptics.tick()
                        withAnimation(.spring(response: 0.34, dampingFraction: 0.78)) {
                            selection = tab.id
                        }
                    }
                } label: {
                    VStack(spacing: 4) {
                        ZStack {
                            if isSelected {
                                Capsule()
                                    .fill(Theme.greenSoft)
                                    .matchedGeometryEffect(id: "pill", in: pill)
                                    .frame(height: 34)
                            }
                            Image(systemName: tab.systemImage)
                                .font(.system(size: 18, weight: .semibold))
                                .foregroundStyle(isSelected ? Theme.greenDeep : Theme.muted)
                                .frame(height: 34)
                                .frame(maxWidth: .infinity)
                        }
                        Text(tab.title)
                            .font(.system(size: 10.5, weight: isSelected ? .semibold : .medium))
                            .foregroundStyle(isSelected ? Theme.greenDeep : Theme.muted)
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                    }
                    .frame(maxWidth: .infinity)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(tab.title)
                .accessibilityAddTraits(isSelected ? [.isSelected, .isButton] : .isButton)
            }
        }
        .padding(.horizontal, 8)
        .padding(.top, 8)
        .padding(.bottom, 2)
        // Material extends under the home indicator for a seamless premium base.
        .background(.regularMaterial, ignoresSafeAreaEdges: .bottom)
        .overlay(alignment: .top) {
            Rectangle().fill(Theme.line).frame(height: 0.5)
        }
    }
}
