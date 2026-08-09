import SwiftUI

// Ported from components/ScreenHeader.tsx
struct ScreenHeader<Right: View>: View {
    let title: String
    var subtitle: String? = nil
    @ViewBuilder var right: () -> Right

    var body: some View {
        HStack(alignment: .bottom) {
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(Fonts.serif(30))
                    .tracking(0.3)
                    .foregroundStyle(Palette.text)
                if let subtitle {
                    Text(subtitle)
                        .font(.system(size: 13))
                        .tracking(0.2)
                        .foregroundStyle(Palette.textMuted)
                }
            }
            Spacer()
            right()
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 14)
    }
}

extension ScreenHeader where Right == EmptyView {
    init(title: String, subtitle: String? = nil) {
        self.init(title: title, subtitle: subtitle, right: { EmptyView() })
    }
}
