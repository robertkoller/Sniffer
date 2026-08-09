import SwiftUI

// Ported from app/index.tsx — search, recent searches, results list, and the
// info-only detail view for a selected suggestion.
struct DiscoverView: View {
    @EnvironmentObject private var auth: AuthStore

    @State private var query = ""
    @State private var suggestions: [FragranceSuggestion]? = nil
    @State private var loading = false
    @State private var errorMessage: String? = nil
    @State private var recentSearches: [String] = Store.load([String].self, key: RECENT_KEY) ?? []

    @State private var selected: FragranceSuggestion? = nil
    @State private var details: FragranceInfo? = nil
    @State private var detailsLoading = false

    @FocusState private var searchFocused: Bool

    private static let recentKey = "sniffy:recentSearches"
    private static let recentLimit = 8

    var body: some View {
        ZStack {
            Palette.bg.ignoresSafeArea()
            if let selected {
                detailView(selected)
            } else {
                mainView
            }
        }
    }

    // MARK: - Main search view

    private var mainView: some View {
        VStack(spacing: 0) {
            ScreenHeader(title: "Discover", subtitle: "Find your next scent")
            searchBar

            if loading {
                centerStatus {
                    ProgressView().scaleEffect(1.4).tint(Palette.gold)
                    Text("Sniffing around…")
                        .font(.system(size: 13)).tracking(0.5)
                        .foregroundStyle(Palette.textMuted)
                }
            } else if let errorMessage {
                centerStatus {
                    Image(systemName: "icloud.slash")
                        .font(.system(size: 30)).foregroundStyle(Palette.textFaint)
                    Text("Nothing found").font(Fonts.serif(20)).foregroundStyle(Palette.text)
                    Text(errorMessage)
                        .font(.system(size: 13)).foregroundStyle(Palette.textMuted)
                        .multilineTextAlignment(.center).lineSpacing(4)
                }
            } else if let suggestions {
                resultsList(suggestions)
            } else {
                idleView
            }
        }
    }

    private var searchBar: some View {
        HStack(spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 16)).foregroundStyle(Palette.textMuted)
                TextField("", text: $query, prompt: Text("Search a fragrance…").foregroundColor(Palette.textFaint))
                    .foregroundStyle(Palette.text)
                    .autocorrectionDisabled()
                    .submitLabel(.search)
                    .focused($searchFocused)
                    .onSubmit { runSearch(query) }
                if !query.isEmpty {
                    Button {
                        query = ""
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 16)).foregroundStyle(Palette.textFaint)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 16)
            .frame(height: 46)
            .background(Palette.surface)
            .clipShape(Capsule())
            .overlay(Capsule().strokeBorder(Palette.borderLight, lineWidth: 1))

            Button {
                runSearch(query)
            } label: {
                Image(systemName: "arrow.right")
                    .font(.system(size: 18)).foregroundStyle(Palette.onGold)
                    .frame(width: 46, height: 46)
                    .background(Palette.gold)
                    .clipShape(Circle())
            }
            .buttonStyle(.plain)
            .opacity(loading ? 0.5 : 1)
            .disabled(loading)
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 8)
    }

    private func resultsList(_ suggestions: [FragranceSuggestion]) -> some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                Text("\(suggestions.count) \(suggestions.count == 1 ? "RESULT" : "RESULTS")")
                    .font(.system(size: 10, weight: .heavy)).tracking(2)
                    .foregroundStyle(Palette.textMuted)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 20)
                    .padding(.vertical, 10)

                ForEach(suggestions) { suggestion in
                    Button {
                        openSuggestion(suggestion)
                    } label: {
                        resultRow(suggestion)
                    }
                    .buttonStyle(.plain)
                }
                Color.clear.frame(height: 32)
            }
        }
        .scrollIndicators(.hidden)
    }

    private func resultRow(_ suggestion: FragranceSuggestion) -> some View {
        HStack(spacing: 14) {
            RemoteImage(url: suggestion.thumbnail ?? suggestion.imageUrl, width: 52, height: 68)
            VStack(alignment: .leading, spacing: 3) {
                Text(suggestion.brand).itemBrandStyle()
                Text(suggestion.name)
                    .font(Fonts.serif(17)).foregroundStyle(Palette.text)
                    .lineLimit(2).multilineTextAlignment(.leading)
                Text([suggestion.year.map(String.init), suggestion.gender].compactMap { $0 }.joined(separator: " · "))
                    .font(.system(size: 12)).foregroundStyle(Palette.textMuted)
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right")
                .font(.system(size: 16)).foregroundStyle(Palette.textFaint)
        }
        .padding(12)
        .background(Palette.surface)
        .clipShape(RoundedRectangle(cornerRadius: Radius.md))
        .overlay(RoundedRectangle(cornerRadius: Radius.md).strokeBorder(Palette.border, lineWidth: 1))
        .padding(.horizontal, 16)
        .padding(.bottom, 8)
    }

    private var idleView: some View {
        ScrollView {
            VStack(spacing: 0) {
                VStack(spacing: 12) {
                    Image(systemName: "sparkles").font(.system(size: 28)).foregroundStyle(Palette.gold)
                    Text("Find your next scent")
                        .font(Fonts.serif(23)).foregroundStyle(Palette.text)
                    Text("Search any fragrance or brand — even abbreviations like “jpg” or “mfk”.")
                        .font(.system(size: 14)).foregroundStyle(Palette.textMuted)
                        .multilineTextAlignment(.center).lineSpacing(4)
                }
                .padding(.horizontal, 40)
                .padding(.top, 48)

                if !recentSearches.isEmpty {
                    VStack(spacing: 0) {
                        HStack {
                            SectionLabel(text: "RECENT")
                            Spacer()
                            Button("Clear") { clearRecentSearches() }
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(Palette.goldDim)
                                .buttonStyle(.plain)
                        }
                        .padding(.bottom, 6)

                        ForEach(recentSearches, id: \.self) { term in
                            Button {
                                runSearch(term)
                            } label: {
                                HStack(spacing: 10) {
                                    Image(systemName: "clock")
                                        .font(.system(size: 15)).foregroundStyle(Palette.textFaint)
                                    Text(term)
                                        .font(.system(size: 14)).foregroundStyle(Palette.textSecondary)
                                    Spacer()
                                }
                                .padding(.vertical, 11)
                                .overlay(alignment: .bottom) { Palette.border.frame(height: 1) }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 36)
                }
            }
        }
        .scrollIndicators(.hidden)
    }

    // MARK: - Detail view

    private func detailView(_ suggestion: FragranceSuggestion) -> some View {
        VStack(spacing: 0) {
            HStack {
                Button {
                    withAnimation(.easeInOut) { selected = nil }
                } label: {
                    HStack(spacing: 8) {
                        Image(systemName: "arrow.left").font(.system(size: 20))
                        Text("Results").font(.system(size: 15, weight: .semibold))
                    }
                    .foregroundStyle(Palette.text)
                }
                .buttonStyle(.plain)
                Spacer()
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)

            ScrollView {
                FragranceCard(
                    name: details?.name ?? suggestion.name,
                    brand: details?.brand ?? suggestion.brand,
                    year: suggestion.year,
                    imageUrl: details?.imageUrl ?? suggestion.imageUrl,
                    overview: details?.overview,
                    notes: details?.notes,
                    noteImages: details?.noteImages,
                    detailsLoading: detailsLoading
                )
                .id(suggestion.id)
                .padding(.bottom, 32)
            }
            .scrollIndicators(.hidden)
        }
        .transition(.opacity)
    }

    // MARK: - Helpers

    @ViewBuilder
    private func centerStatus<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        VStack(spacing: 12) { content() }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .padding(40)
    }

    private func rememberSearch(_ term: String) {
        var next = [term] + recentSearches.filter { $0 != term }
        if next.count > Self.recentLimit {
            next = Array(next.prefix(Self.recentLimit))
        }
        recentSearches = next
        Store.save(next, key: Self.recentKey)
    }

    private func clearRecentSearches() {
        recentSearches = []
        Store.remove(key: Self.recentKey)
    }

    private func runSearch(_ term: String) {
        let trimmed = term.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !loading else { return }
        query = trimmed
        searchFocused = false
        loading = true
        suggestions = nil
        selected = nil
        details = nil
        errorMessage = nil
        Task {
            do {
                let results = try await API.suggestFragrances(trimmed, token: auth.token)
                if results.isEmpty {
                    errorMessage = "No fragrances found for “\(trimmed)”."
                } else {
                    suggestions = results
                    rememberSearch(trimmed)
                }
            } catch {
                errorMessage = (error as? APIError)?.errorDescription ?? "Search failed. Is the server running?"
            }
            loading = false
        }
    }

    private func openSuggestion(_ suggestion: FragranceSuggestion) {
        withAnimation(.easeInOut) { selected = suggestion }
        details = nil
        detailsLoading = true
        Task {
            let info = try? await API.fetchFragranceInfoCached(
                API.InfoParams(name: suggestion.name, brand: suggestion.brand, url: suggestion.url, imageUrl: suggestion.imageUrl)
            )
            if let info { details = info }
            detailsLoading = false
        }
    }
}

// File-scope constants referenced by @State default above.
private let RECENT_KEY = "sniffy:recentSearches"
