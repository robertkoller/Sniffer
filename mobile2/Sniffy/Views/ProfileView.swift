import SwiftUI

// Ported from app/profile.tsx — identity strip, social cards, wear/compliment
// charts, stat tiles, signature scent, top brand, and taste/season bars.
// Settings (account + taste editor) live in a sheet.
struct ProfileView: View {
    @EnvironmentObject private var library: LibraryStore
    @EnvironmentObject private var auth: AuthStore
    @State private var settingsVisible = false

    private struct Stats {
        var totalWears = 0
        var averageRating = 0.0
        var signature: CollectionItem?
        var topBrand: String?
        var topBrandCount = 0
        var topNotes: [(note: String, count: Int)] = []
        var maxNoteCount = 1
        var seasonCounts: [(season: String, count: Int)] = []
        var maxSeasonCount = 1
        var hasSeasonData = false
    }

    private var stats: Stats {
        var result = Stats()
        let collection = library.collection
        let rated = collection.filter { ($0.rating ?? 0) > 0 }
        result.totalWears = collection.reduce(0) { $0 + ($1.wearCount ?? 0) }
        if !rated.isEmpty {
            result.averageRating = rated.reduce(0.0) { $0 + ($1.rating ?? 0) } / Double(rated.count)
        }
        result.signature = rated.sorted { a, b in
            let byRating = (a.rating ?? 0) - (b.rating ?? 0)
            if byRating != 0 { return byRating > 0 }
            return (a.wearCount ?? 0) > (b.wearCount ?? 0)
        }.first

        var brandCounts: [String: Int] = [:]
        for item in collection { brandCounts[item.brand, default: 0] += 1 }
        if let top = brandCounts.max(by: { $0.value < $1.value }) {
            result.topBrand = top.key
            result.topBrandCount = top.value
        }

        var noteCounts: [String: Int] = [:]
        for item in collection {
            let all = (item.notes?.top ?? []) + (item.notes?.middle ?? []) + (item.notes?.base ?? [])
            for note in all {
                let key = note.trimmingCharacters(in: .whitespaces).lowercased()
                if !key.isEmpty { noteCounts[key, default: 0] += 1 }
            }
        }
        result.topNotes = noteCounts.map { (note: $0.key, count: $0.value) }
            .sorted { $0.count > $1.count }
            .prefix(6).map { $0 }
        result.maxNoteCount = max(1, result.topNotes.map(\.count).max() ?? 1)

        result.seasonCounts = SEASONS.map { season in
            (season: season, count: collection.filter { ($0.seasons ?? []).contains(season) }.count)
        }
        result.maxSeasonCount = max(1, result.seasonCounts.map(\.count).max() ?? 1)
        result.hasSeasonData = result.seasonCounts.contains { $0.count > 0 }
        return result
    }

    var body: some View {
        ZStack {
            Palette.bg.ignoresSafeArea()
            VStack(spacing: 0) {
                ScreenHeader(title: "Profile", subtitle: "Your scent story") {
                    Button { settingsVisible = true } label: {
                        Image(systemName: "gearshape").font(.system(size: 18)).foregroundStyle(Palette.goldBright)
                            .frame(width: 38, height: 38)
                            .overlay(Circle().strokeBorder(Palette.goldDim, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
                ScrollView {
                    LazyVStack(spacing: 10) {
                        identityStrip
                        CurrentlyWearingCard()
                        ShowcaseShelf()
                        ComplimentsCard()
                        WearsPerBottleCard()
                        WearTimelineCard()

                        if library.collection.isEmpty && library.wishlist.isEmpty {
                            emptyHint
                        }

                        statGrid
                        if let signature = stats.signature { signatureCard(signature) }
                        if let topBrand = stats.topBrand, library.collection.count > 1 { topBrandCard(topBrand) }
                        if !stats.topNotes.isEmpty { tasteProfileBars }
                        if stats.hasSeasonData { seasonSplitBars }
                    }
                    .padding(.bottom, 32)
                }
                .scrollIndicators(.hidden)
            }
        }
        .sheet(isPresented: $settingsVisible) { SettingsSheet() }
    }

    @ViewBuilder
    private var identityStrip: some View {
        if let user = auth.user {
            HStack(spacing: 12) {
                Avatar(name: user.name, picture: user.picture, size: 44)
                VStack(alignment: .leading, spacing: 2) {
                    Text(user.name).font(Fonts.serif(17)).foregroundStyle(Palette.text)
                    Text("Synced to your account").font(.system(size: 12)).foregroundStyle(Palette.textMuted)
                }
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 20).padding(.bottom, 14)
        } else {
            Button { settingsVisible = true } label: {
                HStack(spacing: 12) {
                    ZStack {
                        Circle().fill(Palette.surfaceGold)
                        Circle().strokeBorder(Palette.goldFaint, lineWidth: 1)
                        Image(systemName: "person").font(.system(size: 18)).foregroundStyle(Palette.gold)
                    }
                    .frame(width: 44, height: 44)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Not signed in").font(Fonts.serif(17)).foregroundStyle(Palette.text)
                        Text("Sign in from Settings to sync your shelf").font(.system(size: 12)).foregroundStyle(Palette.textMuted)
                    }
                    Spacer(minLength: 0)
                    Image(systemName: "chevron.right").font(.system(size: 16)).foregroundStyle(Palette.textFaint)
                }
                .padding(.horizontal, 20).padding(.bottom, 14)
            }
            .buttonStyle(.plain)
        }
    }

    private var emptyHint: some View {
        HStack(spacing: 10) {
            Image(systemName: "sparkles").font(.system(size: 16)).foregroundStyle(Palette.textFaint)
            Text("Your stats and signature scent appear here once you start collecting.")
                .font(.system(size: 13)).foregroundStyle(Palette.textFaint).lineSpacing(2)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 24).padding(.vertical, 14)
    }

    private var statGrid: some View {
        let tiles: [(String, String)] = [
            ("\(library.collection.count)", "BOTTLES"),
            ("\(library.wishlist.count)", "WISHLISTED"),
            ("\(stats.totalWears)", "WEARS"),
            (stats.averageRating > 0 ? String(format: "%.1f", stats.averageRating) : "—", "AVG RATING"),
        ]
        return LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
            ForEach(tiles, id: \.1) { value, label in
                VStack(spacing: 4) {
                    Text(value).font(Fonts.serif(28)).foregroundStyle(Palette.goldBright)
                    Text(label).font(.system(size: 9, weight: .heavy)).tracking(2).foregroundStyle(Palette.textMuted)
                }
                .frame(maxWidth: .infinity).padding(.vertical, 18)
                .background(Palette.surface).clipShape(RoundedRectangle(cornerRadius: Radius.md))
                .overlay(RoundedRectangle(cornerRadius: Radius.md).strokeBorder(Palette.border, lineWidth: 1))
            }
        }
        .padding(.horizontal, 16)
    }

    private func signatureCard(_ signature: CollectionItem) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            CardHeaderLabel(icon: "rosette", text: "SIGNATURE SCENT").padding(.bottom, 10)
            HStack(spacing: 16) {
                RemoteImage(url: signature.imageUrl, width: 80, height: 108, fallbackIconSize: 30)
                VStack(alignment: .leading, spacing: 5) {
                    Text(signature.brand).itemBrandStyle()
                    Text(signature.name).font(Fonts.serif(24)).foregroundStyle(Palette.text)
                    RatingBadge(rating: signature.rating, large: true).padding(.top, 2)
                    if let wearCount = signature.wearCount, wearCount > 0 {
                        Text("worn \(wearCount) \(wearCount == 1 ? "time" : "times")")
                            .font(.system(size: 12)).foregroundStyle(Palette.textMuted).padding(.top, 2)
                    }
                }
                Spacer(minLength: 0)
            }
        }
        .sniffyCard(background: Palette.surfaceGold, borderColor: Palette.goldFaint)
        .padding(.horizontal, 16)
    }

    private func topBrandCard(_ topBrand: String) -> some View {
        HStack(spacing: 10) {
            Image(systemName: "building.2").font(.system(size: 16)).foregroundStyle(Palette.textMuted)
            (Text("Favorite house: ").foregroundColor(Palette.textSecondary)
             + Text(topBrand).foregroundColor(Palette.text).bold()
             + Text(stats.topBrandCount > 1 ? " (\(stats.topBrandCount) bottles)" : "").foregroundColor(Palette.textSecondary))
                .font(.system(size: 14))
            Spacer(minLength: 0)
        }
        .sniffyCard(padding: 16, cornerRadius: Radius.md)
        .padding(.horizontal, 16)
    }

    private var tasteProfileBars: some View {
        VStack(alignment: .leading, spacing: 0) {
            SectionLabel(text: "TASTE PROFILE", color: Palette.gold)
            Text("Notes that show up most in your collection")
                .font(.system(size: 12)).foregroundStyle(Palette.textMuted).padding(.top, 4).padding(.bottom, 14)
            ForEach(stats.topNotes, id: \.note) { entry in
                barRow(label: entry.note, count: entry.count, fraction: Double(entry.count) / Double(stats.maxNoteCount))
            }
        }
        .sniffyCard()
        .padding(.horizontal, 16)
    }

    private var seasonSplitBars: some View {
        VStack(alignment: .leading, spacing: 0) {
            SectionLabel(text: "SEASON SPLIT", color: Palette.gold)
            Text("How your bottles are tagged by season")
                .font(.system(size: 12)).foregroundStyle(Palette.textMuted).padding(.top, 4).padding(.bottom, 14)
            ForEach(stats.seasonCounts, id: \.season) { entry in
                barRow(label: entry.season, count: entry.count, fraction: Double(entry.count) / Double(stats.maxSeasonCount))
            }
        }
        .sniffyCard()
        .padding(.horizontal, 16)
    }

    private func barRow(label: String, count: Int, fraction: Double) -> some View {
        HStack(spacing: 10) {
            Text(label.capitalizedFirst).font(.system(size: 12)).foregroundStyle(Palette.textSecondary)
                .lineLimit(1).frame(width: 90, alignment: .leading)
            MagnitudeBar(fraction: fraction)
            Text("\(count)").font(.system(size: 12)).foregroundStyle(Palette.textMuted).frame(width: 20, alignment: .trailing)
        }
        .padding(.bottom, 10)
    }
}

// Settings sheet: account management + taste questions.
struct SettingsSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 10) {
                    SectionLabel(text: "ACCOUNT")
                        .padding(.horizontal, 4).padding(.top, 10)
                    AccountCard()
                    SectionLabel(text: "PREFERENCES")
                        .padding(.horizontal, 4).padding(.top, 4)
                    TasteProfileCard()
                    SectionLabel(text: "ABOUT")
                        .padding(.horizontal, 4).padding(.top, 4)
                    Button {
                        if let url = API.privacyURL { openURL(url) }
                    } label: {
                        HStack {
                            Image(systemName: "hand.raised").font(.system(size: 15)).foregroundStyle(Palette.gold)
                            Text("Privacy Policy").font(.system(size: 15, weight: .semibold)).foregroundStyle(Palette.text)
                            Spacer()
                            Image(systemName: "arrow.up.right").font(.system(size: 13)).foregroundStyle(Palette.textFaint)
                        }
                        .sniffyCard(padding: 16, cornerRadius: Radius.md)
                    }
                    .buttonStyle(.plain)
                    Color.clear.frame(height: 40)
                }
                .padding(.horizontal, 16)
            }
            .scrollIndicators(.hidden)
            .background(Palette.bg.ignoresSafeArea())
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .font(.system(size: 15, weight: .bold)).foregroundStyle(Palette.goldBright)
                }
            }
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
    }
}

// Taste profile editor — drives search ordering and "your taste" matches.
struct TasteProfileCard: View {
    @EnvironmentObject private var profile: ProfileStore

    private struct GenderOption { let value: GenderPreference; let label: String }
    private let genderOptions: [GenderOption] = [
        .init(value: .men, label: "Men's"),
        .init(value: .women, label: "Women's"),
        .init(value: .all, label: "Everything"),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            CardHeaderLabel(icon: "slider.horizontal.3", text: "TASTE PROFILE")
            Text("Sniffy uses this to sort search results and flag scents you'll probably like.")
                .font(.system(size: 12)).foregroundStyle(Palette.textMuted).lineSpacing(2)
                .padding(.top, 4)

            Text("What do you wear?").font(.system(size: 14, weight: .semibold)).foregroundStyle(Palette.text)
                .padding(.top, 14).padding(.bottom, 10)
            FlowLayout(spacing: 8) {
                ForEach(genderOptions, id: \.value) { option in
                    let selected = profile.profile.genderPreference == option.value
                    chip(option.label, selected: selected) { profile.updateProfile(genderPreference: option.value) }
                }
            }

            Text("What kind of scents do you like?").font(.system(size: 14, weight: .semibold)).foregroundStyle(Palette.text)
                .padding(.top, 14).padding(.bottom, 10)
            FlowLayout(spacing: 8) {
                ForEach(SCENT_FAMILIES, id: \.self) { family in
                    let selected = profile.profile.scentFamilies.contains(family)
                    chip(family.capitalizedFirst, selected: selected) { profile.toggleFamily(family) }
                }
            }
        }
        .sniffyCard()
    }

    private func chip(_ label: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(selected ? Palette.goldBright : Palette.textMuted)
                .padding(.horizontal, 13).padding(.vertical, 7)
                .background(selected ? Palette.surfaceGold : Color.clear)
                .clipShape(Capsule())
                .overlay(Capsule().strokeBorder(selected ? Palette.goldDim : Palette.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}
