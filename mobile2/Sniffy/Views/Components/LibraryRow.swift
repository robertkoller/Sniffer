import SwiftUI

// Ported from components/LibraryRow.tsx. Card row used by Collection, Wishlist,
// and Rankings lists.
struct LibraryRow: View {
    let item: SavedFragrance
    let onPress: () -> Void
    var rank: Int? = nil
    var showPrice: Bool = false
    var showWears: Bool = false

    private var tags: [String] {
        (item.seasons ?? []) + (item.occasions ?? [])
    }

    var body: some View {
        Button(action: onPress) {
            HStack(spacing: 12) {
                if let rank {
                    Text("\(rank)")
                        .font(Fonts.serif(20))
                        .foregroundStyle(rank <= 3 ? Palette.goldBright : Palette.textFaint)
                        .frame(width: 30)
                        .multilineTextAlignment(.center)
                }

                RemoteImage(url: item.imageUrl, width: 44, height: 58, fallbackIconSize: 18)

                VStack(alignment: .leading, spacing: 4) {
                    Text(item.brand).itemBrandStyle()
                    Text(item.name)
                        .font(Fonts.serif(18))
                        .foregroundStyle(Palette.text)
                        .lineLimit(1)

                    HStack(spacing: 10) {
                        RatingBadge(rating: item.rating)
                        if showPrice, let price = item.lowestPrice {
                            Text("from \(price)")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(Palette.trusted)
                        }
                        if showWears, let wearCount = item.wearCount, wearCount > 0 {
                            Text("\(wearCount) \(wearCount == 1 ? "wear" : "wears")")
                                .font(.system(size: 12))
                                .foregroundStyle(Palette.textMuted)
                        }
                    }
                    .padding(.top, 2)

                    if !tags.isEmpty {
                        TagPills(options: tags, selected: tags, compact: true)
                            .padding(.top, 6)
                    }
                }

                Spacer(minLength: 0)

                Image(systemName: "chevron.right")
                    .font(.system(size: 16))
                    .foregroundStyle(Palette.textFaint)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .background(Palette.surface)
            .clipShape(RoundedRectangle(cornerRadius: Radius.md))
            .overlay(RoundedRectangle(cornerRadius: Radius.md).strokeBorder(Palette.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .padding(.horizontal, 16)
        .padding(.bottom, 10)
    }
}
