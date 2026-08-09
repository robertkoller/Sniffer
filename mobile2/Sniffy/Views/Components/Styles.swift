import SwiftUI

// Recurring surface card: 1px border, rounded, horizontal margins handled by caller.
struct CardModifier: ViewModifier {
    var padding: CGFloat = 18
    var cornerRadius: CGFloat = Radius.lg
    var background: Color = Palette.surface
    var borderColor: Color = Palette.border

    func body(content: Content) -> some View {
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(background)
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius))
            .overlay(RoundedRectangle(cornerRadius: cornerRadius).strokeBorder(borderColor, lineWidth: 1))
    }
}

extension View {
    func sniffyCard(
        padding: CGFloat = 18,
        cornerRadius: CGFloat = Radius.lg,
        background: Color = Palette.surface,
        borderColor: Color = Palette.border
    ) -> some View {
        modifier(CardModifier(padding: padding, cornerRadius: cornerRadius, background: background, borderColor: borderColor))
    }
}

// Gold-on-uppercase eyebrow used as card headers (with an SF Symbol icon).
struct CardHeaderLabel: View {
    let icon: String
    let text: String
    var color: Color = Palette.gold

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: icon)
                .font(.system(size: 13))
                .foregroundStyle(color)
            Text(text)
                .font(.system(size: 10, weight: .heavy))
                .tracking(2)
                .foregroundStyle(color)
        }
    }
}

// Plain uppercase section label (no icon).
struct SectionLabel: View {
    let text: String
    var color: Color = Palette.textMuted

    var body: some View {
        Text(text)
            .font(.system(size: 10, weight: .heavy))
            .tracking(2)
            .foregroundStyle(color)
    }
}

// Filled gold pill button with an icon + uppercase label (SEE PRICES, DONE, …).
struct GoldPillButton: View {
    let icon: String?
    let title: String
    let action: () -> Void
    var verticalPadding: CGFloat = 13

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if let icon {
                    Image(systemName: icon).font(.system(size: 15))
                }
                Text(title)
                    .font(.system(size: 11, weight: .heavy))
                    .tracking(1.2)
            }
            .foregroundStyle(Palette.onGold)
            .frame(maxWidth: .infinity)
            .padding(.vertical, verticalPadding)
            .background(Palette.gold)
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }
}

// A circular icon button with a gold border (add "+" etc.).
struct CircleIconButton: View {
    let icon: String
    var filled: Bool = false
    var diameter: CGFloat = 38
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            ZStack {
                if filled {
                    Circle().fill(Palette.gold)
                } else {
                    Circle().strokeBorder(Palette.goldDim, lineWidth: 1)
                }
                Image(systemName: icon)
                    .font(.system(size: 20, weight: .medium))
                    .foregroundStyle(filled ? Palette.onGold : Palette.goldBright)
            }
            .frame(width: diameter, height: diameter)
        }
        .buttonStyle(.plain)
    }
}
