import SwiftUI

// Ported from app/wishlist.tsx
struct WishlistView: View {
    @EnvironmentObject private var library: LibraryStore
    @State private var selectedSlug: String? = nil
    @State private var addVisible = false

    // Highest "want it" priority first, then most recently added.
    private var sortedItems: [WishlistItem] {
        library.wishlist.sorted { a, b in
            let byPriority = (b.rating ?? 0) - (a.rating ?? 0)
            if byPriority != 0 { return byPriority < 0 }
            return b.addedAt < a.addedAt
        }
    }

    private var selectedItem: SavedFragrance? {
        library.wishlist.first { $0.slug == selectedSlug }
    }

    var body: some View {
        ZStack {
            Palette.bg.ignoresSafeArea()
            VStack(spacing: 0) {
                ScreenHeader(
                    title: "Wishlist",
                    subtitle: "\(library.wishlist.count) \(library.wishlist.count == 1 ? "scent" : "scents") you're hunting"
                ) {
                    CircleIconButton(icon: "plus", filled: true) { addVisible = true }
                }

                if library.wishlist.isEmpty {
                    EmptyState(
                        icon: "bookmark",
                        title: "Nothing saved yet",
                        subtitle: "Tap + to save a fragrance and rank how badly you want it."
                    )
                } else {
                    ScrollView {
                        LazyVStack(spacing: 0) {
                            ForEach(sortedItems) { item in
                                LibraryRow(item: item, onPress: { selectedSlug = item.slug }, showPrice: true)
                            }
                        }
                        .padding(.top, 6)
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
                FragranceDetailSheet(item: item, mode: .wishlist) { selectedSlug = nil }
            }
        }
        .sheet(isPresented: $addVisible) {
            AddFragranceModal(mode: .wishlist)
        }
    }
}

// Lightweight Identifiable wrapper so a slug can drive a `.sheet(item:)`.
struct IdentifiedSlug: Identifiable, Equatable {
    let slug: String
    var id: String { slug }
}
