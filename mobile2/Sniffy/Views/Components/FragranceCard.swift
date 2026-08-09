import SwiftUI

// Ported from components/FragranceCard.tsx. Hero card for a fragrance: identity
// + image, notes when loaded, save actions, and a link to Sniffer for prices.
struct FragranceCard: View {
    let name: String
    let brand: String
    var year: Int? = nil
    var imageUrl: String? = nil
    var overview: String? = nil
    var notes: FragranceNotes? = nil
    var noteImages: NoteImages? = nil
    var detailsLoading: Bool = false

    @EnvironmentObject private var library: LibraryStore
    @EnvironmentObject private var profile: ProfileStore
    @Environment(\.openURL) private var openURL

    private var slug: String { makeSlug(brand, name) }
    private var inCollection: Bool { library.isInCollection(slug) }
    private var inWishlist: Bool { library.isInWishlist(slug) }

    private var snapshot: SavedFragrance {
        SavedFragrance(slug: slug, name: name, brand: brand, imageUrl: imageUrl,
                       notes: notes, noteImages: noteImages, overview: overview)
    }

    private var hasNotes: Bool {
        guard let notes else { return false }
        return !notes.top.isEmpty || !notes.middle.isEmpty || !notes.base.isEmpty
    }

    private var tasteMatches: [String] {
        matchTasteFamilies(notes, profile.profile.scentFamilies)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 16) {
                RemoteImage(url: imageUrl, width: 92, height: 122, fallbackIconSize: 28)
                VStack(alignment: .leading, spacing: 4) {
                    Text(brand).eyebrowStyle()
                    Text(name)
                        .font(Fonts.serif(25))
                        .foregroundStyle(Palette.text)
                    if let year {
                        Text("\(year)")
                            .font(.system(size: 13))
                            .foregroundStyle(Palette.textMuted)
                    }
                }
                Spacer(minLength: 0)
            }
            .padding(.bottom, 14)

            if !tasteMatches.isEmpty {
                HStack(spacing: 6) {
                    Image(systemName: "heart.fill")
                        .font(.system(size: 12))
                        .foregroundStyle(Palette.goldBright)
                    Text("YOUR TASTE · \(tasteMatches.joined(separator: " · ").uppercased())")
                        .font(.system(size: 9, weight: .heavy))
                        .tracking(1)
                        .foregroundStyle(Palette.goldBright)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(Palette.surfaceGold)
                .clipShape(Capsule())
                .overlay(Capsule().strokeBorder(Palette.goldFaint, lineWidth: 1))
                .padding(.bottom, 12)
            }

            if let overview, !overview.isEmpty {
                Text(overview)
                    .font(.system(size: 14))
                    .foregroundStyle(Palette.textSecondary)
                    .lineSpacing(4)
                    .lineLimit(4)
                    .padding(.bottom, 14)
            }

            if hasNotes, let notes {
                NotesPyramid(notes: notes, noteImages: noteImages)
                    .padding(.bottom, 16)
            }

            if detailsLoading {
                HStack(spacing: 10) {
                    ProgressView().tint(Palette.gold)
                    Text("Loading notes & details…")
                        .font(.system(size: 13))
                        .foregroundStyle(Palette.textMuted)
                }
                .padding(.bottom, 16)
            }

            HStack(spacing: 10) {
                saveButton(
                    filled: inCollection,
                    icon: inCollection ? "checkmark" : "plus",
                    title: inCollection ? "IN COLLECTION" : "COLLECTION"
                ) {
                    inCollection ? library.removeFromCollection(slug) : library.addToCollection(snapshot)
                }
                saveButton(
                    filled: inWishlist,
                    icon: inWishlist ? "bookmark.fill" : "bookmark",
                    title: inWishlist ? "WISHLISTED" : "WISHLIST"
                ) {
                    inWishlist ? library.removeFromWishlist(slug) : library.addToWishlist(snapshot)
                }
            }
            .padding(.bottom, 10)

            GoldPillButton(icon: "tag", title: "SEE PRICES ON SNIFFER") {
                if let url = API.snifferPageUrl(brand, name) {
                    openURL(url)
                }
            }
        }
        .padding(20)
        .background(Palette.surface)
        .clipShape(RoundedRectangle(cornerRadius: Radius.lg))
        .overlay(RoundedRectangle(cornerRadius: Radius.lg).strokeBorder(Palette.border, lineWidth: 1))
        .padding(.horizontal, 16)
        .padding(.top, 16)
    }

    private func saveButton(filled: Bool, icon: String, title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: icon).font(.system(size: 14))
                Text(title)
                    .font(.system(size: 10, weight: .heavy))
                    .tracking(1.2)
            }
            .foregroundStyle(filled ? Palette.onGold : Palette.goldBright)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(filled ? Palette.gold : Color.clear)
            .clipShape(Capsule())
            .overlay(Capsule().strokeBorder(filled ? Palette.gold : Palette.goldDim, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}
