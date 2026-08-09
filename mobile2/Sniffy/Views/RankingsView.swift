import SwiftUI

// Ported from app/rankings.tsx — podium (top 3), remainder list, and unrated.
struct RankingsView: View {
    @EnvironmentObject private var library: LibraryStore
    @State private var selectedSlug: String? = nil
    @State private var addVisible = false

    private static let medalColors = [Palette.medalGold, Palette.medalSilver, Palette.medalBronze]

    private var rated: [CollectionItem] {
        library.collection
            .filter { ($0.rating ?? 0) > 0 }
            .sorted { a, b in
                let byRating = (a.rating ?? 0) - (b.rating ?? 0)
                if byRating != 0 { return byRating > 0 }
                return (a.wearCount ?? 0) > (b.wearCount ?? 0)
            }
    }
    private var podium: [CollectionItem] { Array(rated.prefix(3)) }
    private var remainder: [CollectionItem] { rated.count > 3 ? Array(rated.dropFirst(3)) : [] }
    private var unrated: [CollectionItem] { library.collection.filter { ($0.rating ?? 0) == 0 } }

    private var selectedItem: SavedFragrance? {
        library.collection.first { $0.slug == selectedSlug }
    }

    var body: some View {
        ZStack {
            Palette.bg.ignoresSafeArea()
            VStack(spacing: 0) {
                ScreenHeader(title: "Rankings", subtitle: "Your collection, best first") {
                    CircleIconButton(icon: "plus", filled: true) { addVisible = true }
                }

                if library.collection.isEmpty || (podium.isEmpty && unrated.isEmpty) {
                    EmptyState(
                        icon: "chart.bar",
                        title: "No rankings yet",
                        subtitle: "Rate the fragrances in your collection and your leaderboard builds itself."
                    )
                } else {
                    ScrollView {
                        LazyVStack(spacing: 0) {
                            ForEach(Array(podium.enumerated()), id: \.element.slug) { index, item in
                                podiumCard(item, index: index)
                            }

                            if !remainder.isEmpty {
                                ForEach(Array(remainder.enumerated()), id: \.element.slug) { index, item in
                                    LibraryRow(item: item, onPress: { selectedSlug = item.slug }, rank: index + 4, showWears: true)
                                }
                                .padding(.top, 4)
                            }

                            if !unrated.isEmpty {
                                SectionLabel(text: "NOT YET RATED")
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .padding(.horizontal, 20)
                                    .padding(.top, 20)
                                    .padding(.bottom, 10)
                                ForEach(unrated) { item in
                                    LibraryRow(item: item, onPress: { selectedSlug = item.slug })
                                }
                            }
                        }
                        .padding(.top, 4)
                        .padding(.bottom, 32)
                    }
                    .scrollIndicators(.hidden)
                }
            }
        }
        .sheet(item: Binding(
            get: { selectedItem.map { IdentifiedSlug(slug: $0.slug) } },
            set: { if $0 == nil { selectedSlug = nil } }
        )) { _ in
            if let item = selectedItem {
                FragranceDetailSheet(item: item, mode: .collection) { selectedSlug = nil }
            }
        }
        .sheet(isPresented: $addVisible) { AddFragranceModal(mode: .collection) }
    }

    private func podiumCard(_ item: CollectionItem, index: Int) -> some View {
        let first = index == 0
        let medal = Self.medalColors[index]
        return Button {
            selectedSlug = item.slug
        } label: {
            HStack(spacing: 14) {
                ZStack {
                    Circle().strokeBorder(medal, lineWidth: 1.5)
                    Text("\(index + 1)")
                        .font(Fonts.serif(18)).foregroundStyle(medal)
                }
                .frame(width: 40, height: 40)

                VStack(alignment: .leading, spacing: 4) {
                    Text(item.brand).itemBrandStyle()
                    Text(item.name)
                        .font(Fonts.serif(first ? 21 : 18))
                        .foregroundStyle(Palette.text)
                        .lineLimit(1)
                    RatingBadge(rating: item.rating, large: true)
                }
                Spacer(minLength: 0)
                if let wearCount = item.wearCount, wearCount > 0 {
                    Text("\(wearCount)×")
                        .font(.system(size: 13, weight: .semibold)).foregroundStyle(Palette.textMuted)
                }
            }
            .padding(16)
            .background(first ? Palette.surfaceGold : Palette.surface)
            .clipShape(RoundedRectangle(cornerRadius: Radius.md))
            .overlay(RoundedRectangle(cornerRadius: Radius.md).strokeBorder(first ? Palette.goldFaint : Palette.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .padding(.horizontal, 16)
        .padding(.bottom, 10)
    }
}
