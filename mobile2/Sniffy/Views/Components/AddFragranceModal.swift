import SwiftUI

// Ported from components/AddFragranceModal.tsx. Search-and-add sheet: find a
// fragrance and drop it straight into the collection or wishlist.
struct AddFragranceModal: View {
    let mode: LibraryMode

    @EnvironmentObject private var library: LibraryStore
    @EnvironmentObject private var auth: AuthStore
    @Environment(\.dismiss) private var dismiss

    @State private var query = ""
    @State private var suggestions: [FragranceSuggestion]? = nil
    @State private var loading = false
    @State private var errorMessage: String? = nil
    @FocusState private var focused: Bool

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                searchRow
                content
            }
            .padding(.horizontal, 18)
            .padding(.bottom, 24)
            .frame(maxHeight: .infinity, alignment: .top)
            .background(Palette.surfaceRaised.ignoresSafeArea())
            .navigationTitle("Add to \(mode == .collection ? "Collection" : "Wishlist")")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { dismiss() } label: {
                        Image(systemName: "xmark").font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(Palette.textMuted)
                    }
                }
            }
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .onAppear { focused = true }
    }

    private var searchRow: some View {
        HStack(spacing: 8) {
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 15)).foregroundStyle(Palette.textMuted)
                TextField("", text: $query, prompt: Text("Search a fragrance…").foregroundColor(Palette.textFaint))
                    .foregroundStyle(Palette.text)
                    .autocorrectionDisabled()
                    .submitLabel(.search)
                    .focused($focused)
                    .onSubmit(runSearch)
            }
            .padding(.horizontal, 14)
            .frame(height: 42)
            .background(Palette.surface)
            .clipShape(Capsule())
            .overlay(Capsule().strokeBorder(Palette.borderLight, lineWidth: 1))

            Button(action: runSearch) {
                Image(systemName: "arrow.right").font(.system(size: 17)).foregroundStyle(Palette.onGold)
                    .frame(width: 42, height: 42).background(Palette.gold).clipShape(Circle())
            }
            .buttonStyle(.plain)
            .opacity(loading ? 0.5 : 1)
            .disabled(loading)
        }
        .padding(.top, 12)
        .padding(.bottom, 12)
    }

    @ViewBuilder
    private var content: some View {
        if loading {
            centerText { ProgressView().tint(Palette.gold); Text("Sniffing around…") }
        } else if let errorMessage {
            centerText { Text(errorMessage) }
        } else if let suggestions {
            ScrollView {
                LazyVStack(spacing: 8) {
                    ForEach(suggestions) { suggestion in
                        resultRow(suggestion)
                    }
                    Color.clear.frame(height: 16)
                }
            }
            .scrollIndicators(.hidden)
            .scrollDismissesKeyboard(.interactively)
        } else {
            centerText { Text("Search anything — “jpg”, “mfk”, “dior sauvage”…") }
        }
    }

    private func resultRow(_ suggestion: FragranceSuggestion) -> some View {
        let slug = makeSlug(suggestion.brand, suggestion.name)
        let saved = mode == .collection ? library.isInCollection(slug) : library.isInWishlist(slug)
        return Button {
            handleAdd(suggestion)
        } label: {
            HStack(spacing: 12) {
                RemoteImage(url: suggestion.thumbnail ?? suggestion.imageUrl, width: 40, height: 52, fallbackIconSize: 16)
                VStack(alignment: .leading, spacing: 2) {
                    Text(suggestion.brand).itemBrandStyle()
                    Text(suggestion.name)
                        .font(Fonts.serif(15)).foregroundStyle(Palette.text).lineLimit(1)
                    Text([suggestion.year.map(String.init), suggestion.gender].compactMap { $0 }.joined(separator: " · "))
                        .font(.system(size: 11)).foregroundStyle(Palette.textMuted)
                }
                Spacer(minLength: 0)
                ZStack {
                    if saved {
                        Circle().fill(Palette.gold)
                    } else {
                        Circle().strokeBorder(Palette.goldDim, lineWidth: 1)
                    }
                    Image(systemName: saved ? "checkmark" : "plus")
                        .font(.system(size: 16))
                        .foregroundStyle(saved ? Palette.onGold : Palette.goldBright)
                }
                .frame(width: 30, height: 30)
            }
            .padding(10)
            .background(Palette.surface)
            .clipShape(RoundedRectangle(cornerRadius: Radius.md))
            .overlay(RoundedRectangle(cornerRadius: Radius.md).strokeBorder(Palette.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private func centerText<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        VStack(spacing: 10) { content() }
            .font(.system(size: 13))
            .foregroundStyle(Palette.textMuted)
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 36)
    }

    private func runSearch() {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !loading else { return }
        loading = true
        suggestions = nil
        errorMessage = nil
        Task {
            do {
                let results = try await API.suggestFragrances(trimmed, token: auth.token)
                if results.isEmpty {
                    errorMessage = "No fragrances found for “\(trimmed)”."
                } else {
                    suggestions = results
                }
            } catch {
                errorMessage = (error as? APIError)?.errorDescription ?? "Search failed. Is the server running?"
            }
            loading = false
        }
    }

    private func handleAdd(_ suggestion: FragranceSuggestion) {
        let slug = makeSlug(suggestion.brand, suggestion.name)
        let saved = mode == .collection ? library.isInCollection(slug) : library.isInWishlist(slug)
        if saved { return }
        let base = SavedFragrance(slug: slug, name: suggestion.name, brand: suggestion.brand, imageUrl: suggestion.imageUrl)
        if mode == .collection {
            library.addToCollection(base)
        } else {
            library.addToWishlist(base)
        }
        // Enrich with notes/overview in the background — the item is already saved
        Task {
            guard let info = try? await API.fetchFragranceInfoCached(
                API.InfoParams(name: suggestion.name, brand: suggestion.brand, url: suggestion.url, imageUrl: suggestion.imageUrl)
            ) else { return }
            let patch: (inout SavedFragrance) -> Void = { item in
                item.notes = info.notes
                item.noteImages = info.noteImages
                item.overview = info.overview
                item.imageUrl = info.imageUrl ?? suggestion.imageUrl
            }
            if mode == .collection {
                library.updateCollectionItem(slug, patch)
            } else {
                library.updateWishlistItem(slug, patch)
            }
        }
    }
}
