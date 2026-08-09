import SwiftUI

// Shared mode flag for the detail sheet / add modal.
enum LibraryMode {
    case collection
    case wishlist
}

// Ported from app/collection.tsx — filter, sort/season chips, collapsible
// sections, add modal, and the section manager.
struct CollectionView: View {
    @EnvironmentObject private var library: LibraryStore

    @State private var filterText = ""
    @State private var sortMode: SortMode = .recent
    @State private var seasonFilter: String? = nil
    @State private var selectedSlug: String? = nil
    @State private var addVisible = false
    @State private var sectionsVisible = false
    @State private var collapsedSections: Set<String> = []

    enum SortMode: String, CaseIterable {
        case recent, rating, name, worn
        var label: String {
            switch self {
            case .recent: return "Recent"
            case .rating: return "Top rated"
            case .name: return "A–Z"
            case .worn: return "Most worn"
            }
        }
    }

    private struct SectionGroup: Identifiable {
        let id: String
        let sectionId: String?
        let name: String
        let items: [CollectionItem]
    }

    private var groups: [SectionGroup] {
        var items = library.collection

        let needle = filterText.trimmingCharacters(in: .whitespaces).lowercased()
        if !needle.isEmpty {
            items = items.filter {
                $0.name.lowercased().contains(needle) || $0.brand.lowercased().contains(needle)
            }
        }
        if let seasonFilter {
            items = items.filter { ($0.seasons ?? []).contains(seasonFilter) }
        }

        var sorted = items
        switch sortMode {
        case .rating:
            sorted.sort { ($0.rating ?? 0) > ($1.rating ?? 0) }
        case .name:
            sorted.sort { "\($0.brand) \($0.name)".localizedCompare("\($1.brand) \($1.name)") == .orderedAscending }
        case .worn:
            sorted.sort { ($0.wearCount ?? 0) > ($1.wearCount ?? 0) }
        case .recent:
            sorted.sort { $0.addedAt > $1.addedAt }
        }

        let sectionIds = Set(library.sections.map(\.id))
        var result: [SectionGroup] = library.sections.map { section in
            SectionGroup(
                id: section.id,
                sectionId: section.id,
                name: section.name,
                items: sorted.filter { $0.sectionId == section.id }
            )
        }
        let unsectioned = sorted.filter { $0.sectionId == nil || !sectionIds.contains($0.sectionId ?? "") }
        if !unsectioned.isEmpty || result.isEmpty {
            result.append(SectionGroup(
                id: "__unsectioned",
                sectionId: nil,
                name: library.sections.isEmpty ? "All bottles" : "Everything else",
                items: unsectioned
            ))
        }
        return result.filter { !$0.items.isEmpty }
    }

    private var selectedItem: SavedFragrance? {
        library.collection.first { $0.slug == selectedSlug }
    }

    var body: some View {
        ZStack {
            Palette.bg.ignoresSafeArea()
            VStack(spacing: 0) {
                ScreenHeader(
                    title: "Collection",
                    subtitle: "\(library.collection.count) \(library.collection.count == 1 ? "bottle" : "bottles")"
                ) {
                    HStack(spacing: 8) {
                        CircleIconButton(icon: "folder", filled: false) { sectionsVisible = true }
                        CircleIconButton(icon: "plus", filled: true) { addVisible = true }
                    }
                }

                if library.collection.isEmpty {
                    EmptyState(
                        icon: "square.stack",
                        title: "No bottles yet",
                        subtitle: "Tap + to add a fragrance, or find one in Discover."
                    )
                } else {
                    filterBar
                    chipRow
                    listView
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
        .sheet(isPresented: $sectionsVisible) { SectionManager() }
    }

    private var filterBar: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 14)).foregroundStyle(Palette.textMuted)
            TextField("", text: $filterText, prompt: Text("Filter your collection…").foregroundColor(Palette.textFaint))
                .foregroundStyle(Palette.text)
                .autocorrectionDisabled()
        }
        .padding(.horizontal, 14)
        .frame(height: 40)
        .background(Palette.surface)
        .clipShape(Capsule())
        .overlay(Capsule().strokeBorder(Palette.border, lineWidth: 1))
        .padding(.horizontal, 16)
        .padding(.bottom, 10)
    }

    private var chipRow: some View {
        FlowLayout(spacing: 6, lineSpacing: 6) {
            ForEach(SortMode.allCases, id: \.self) { mode in
                chip(text: mode.label, selected: sortMode == mode) { sortMode = mode }
            }
            ForEach(SEASONS, id: \.self) { season in
                chip(text: season, selected: seasonFilter == season) {
                    seasonFilter = (seasonFilter == season) ? nil : season
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 8)
    }

    private func chip(text: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(text.capitalizedFirst)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(selected ? Palette.goldBright : Palette.textMuted)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(selected ? Palette.surfaceGold : Color.clear)
                .clipShape(Capsule())
                .overlay(Capsule().strokeBorder(selected ? Palette.goldDim : Palette.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private var listView: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                if groups.isEmpty {
                    Text("Nothing matches those filters.")
                        .font(.system(size: 13)).foregroundStyle(Palette.textMuted)
                        .padding(.top, 32)
                }
                ForEach(groups) { group in
                    let collapsed = collapsedSections.contains(group.id)
                    Button {
                        toggleCollapsed(group.id)
                    } label: {
                        HStack(spacing: 8) {
                            Image(systemName: collapsed ? "chevron.right" : "chevron.down")
                                .font(.system(size: 14)).foregroundStyle(Palette.goldDim)
                            Text(group.name.uppercased())
                                .font(.system(size: 11, weight: .heavy)).tracking(2)
                                .foregroundStyle(Palette.gold)
                            Text("\(group.items.count)")
                                .font(.system(size: 11, weight: .semibold)).foregroundStyle(Palette.textFaint)
                            Spacer()
                        }
                        .padding(.horizontal, 20)
                        .padding(.top, 14)
                        .padding(.bottom, 8)
                    }
                    .buttonStyle(.plain)

                    if !collapsed {
                        ForEach(group.items) { item in
                            LibraryRow(item: item, onPress: { selectedSlug = item.slug }, showWears: true)
                        }
                    }
                }
            }
            .padding(.top, 6)
            .padding(.bottom, 32)
        }
        .scrollIndicators(.hidden)
    }

    private func toggleCollapsed(_ key: String) {
        if collapsedSections.contains(key) {
            collapsedSections.remove(key)
        } else {
            collapsedSections.insert(key)
        }
    }
}
