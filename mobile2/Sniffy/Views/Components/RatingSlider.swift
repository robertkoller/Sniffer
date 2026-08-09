import SwiftUI

// Ported from components/RatingSlider.tsx. Decimal rating out of 10 — drag or
// tap the track. Values snap to 0.1. 0 = unrated.
struct RatingSlider: View {
    let rating: Double            // 0–10, one decimal
    let onChange: (Double) -> Void
    var label: String? = nil

    @State private var trackWidth: CGFloat = 0
    @State private var draftRating: Double? = nil

    private var shownRating: Double { draftRating ?? rating }

    private func value(fromX x: CGFloat) -> Double {
        guard trackWidth > 0 else { return shownRating }
        let raw = Double(x / trackWidth) * 10.0
        let clamped = min(max(raw, 0.0), 10.0)
        return (clamped * 10.0).rounded() / 10.0
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .firstTextBaseline) {
                if let label {
                    Text(label)
                        .font(.system(size: 10, weight: .heavy))
                        .tracking(2)
                        .foregroundStyle(Palette.textMuted)
                }
                Spacer()
                HStack(alignment: .firstTextBaseline, spacing: 0) {
                    Text(shownRating > 0 ? String(format: "%.1f", shownRating) : "—")
                        .font(Fonts.serif(26))
                        .foregroundStyle(Palette.goldBright)
                    Text(" / 10")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Palette.textMuted)
                }
            }
            .padding(.bottom, 10)

            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: Radius.pill)
                        .fill(Palette.surface)
                        .overlay(RoundedRectangle(cornerRadius: Radius.pill).strokeBorder(Palette.borderLight, lineWidth: 1))
                    Palette.goldDim
                        .frame(width: max(0, geometry.size.width * (shownRating / 10)))
                    ForEach([2, 4, 6, 8], id: \.self) { tick in
                        Palette.borderLight
                            .frame(width: 1)
                            .padding(.vertical, 8)
                            .offset(x: geometry.size.width * (Double(tick) / 10))
                    }
                }
                .clipShape(RoundedRectangle(cornerRadius: Radius.pill))
                .onAppear { trackWidth = geometry.size.width }
                .onChange(of: geometry.size.width) { _, newValue in trackWidth = newValue }
                .contentShape(Rectangle())
                .gesture(
                    DragGesture(minimumDistance: 0)
                        .onChanged { drag in draftRating = value(fromX: drag.location.x) }
                        .onEnded { drag in
                            let final = value(fromX: drag.location.x)
                            draftRating = nil
                            onChange(final)
                        }
                )
            }
            .frame(height: 30)

            HStack {
                Text("0")
                Spacer()
                Text("5")
                Spacer()
                Text("10")
            }
            .font(.system(size: 10))
            .foregroundStyle(Palette.textFaint)
            .padding(.top, 6)
            .padding(.horizontal, 2)
        }
    }
}

// Small read-only badge used in list rows (RatingBadge in the RN app).
struct RatingBadge: View {
    let rating: Double?
    var large: Bool = false

    var body: some View {
        if let rating, rating > 0 {
            Text(String(format: "%.1f", rating))
                .font(Fonts.serif(large ? 17 : 13))
                .foregroundStyle(Palette.goldBright)
                .padding(.horizontal, large ? 10 : 7)
                .padding(.vertical, large ? 4 : 2)
                .background(Palette.surfaceGold)
                .clipShape(RoundedRectangle(cornerRadius: Radius.sm))
                .overlay(RoundedRectangle(cornerRadius: Radius.sm).strokeBorder(Palette.goldFaint, lineWidth: 1))
        }
    }
}
