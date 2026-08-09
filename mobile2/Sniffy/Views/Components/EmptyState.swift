import SwiftUI

// Ported from components/EmptyState.tsx. `icon` is an SF Symbol name.
struct EmptyState: View {
    let icon: String
    let title: String
    let subtitle: String

    var body: some View {
        VStack(spacing: 0) {
            ZStack {
                Circle()
                    .fill(Palette.surfaceGold)
                    .overlay(Circle().strokeBorder(Palette.goldFaint, lineWidth: 1))
                Image(systemName: icon)
                    .font(.system(size: 30))
                    .foregroundStyle(Palette.gold)
            }
            .frame(width: 76, height: 76)
            .padding(.bottom, 22)

            Text(title)
                .font(Fonts.serif(25))
                .foregroundStyle(Palette.text)
                .multilineTextAlignment(.center)
                .padding(.bottom, 14)

            Rectangle()
                .fill(Palette.goldDim)
                .frame(width: 36, height: 2)
                .padding(.bottom, 14)

            Text(subtitle)
                .font(.system(size: 14))
                .foregroundStyle(Palette.textMuted)
                .multilineTextAlignment(.center)
                .lineSpacing(4)
                .frame(maxWidth: 260)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(48)
    }
}
