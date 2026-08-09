import SwiftUI

// Ported from components/SectionManager.tsx. Create/delete collection sections,
// plus one-tap auto-sort by scent type.
struct SectionManager: View {
    @EnvironmentObject private var library: LibraryStore
    @EnvironmentObject private var profile: ProfileStore
    @Environment(\.dismiss) private var dismiss

    @State private var newName = ""

    private func countFor(_ sectionId: String) -> Int {
        library.collection.filter { $0.sectionId == sectionId }.count
    }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 0) {
                GoldPillButton(icon: "wand.and.stars", title: "AUTO-SORT BY SCENT TYPE", action: autoSortByScentType, verticalPadding: 12)
                    .padding(.top, 8)

                Text("Creates sections like Woody or Fresh from each bottle's notes — your preferred families win ties. You can still move anything afterwards.")
                    .font(.system(size: 11)).foregroundStyle(Palette.textFaint).lineSpacing(3)
                    .padding(.top, 8).padding(.bottom, 16)

                HStack(spacing: 8) {
                    TextField("", text: $newName, prompt: Text("New section name…").foregroundColor(Palette.textFaint))
                        .foregroundStyle(Palette.text)
                        .submitLabel(.done)
                        .onSubmit(handleAdd)
                        .padding(.horizontal, 16)
                        .frame(height: 42)
                        .background(Palette.surface)
                        .clipShape(Capsule())
                        .overlay(Capsule().strokeBorder(Palette.borderLight, lineWidth: 1))
                    Button(action: handleAdd) {
                        Image(systemName: "plus").font(.system(size: 18)).foregroundStyle(Palette.onGold)
                            .frame(width: 42, height: 42).background(Palette.gold).clipShape(Circle())
                    }
                    .buttonStyle(.plain)
                }
                .padding(.bottom, 12)

                if library.sections.isEmpty {
                    Text("No sections yet — add one above or use auto-sort.")
                        .font(.system(size: 13)).foregroundStyle(Palette.textMuted)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 18)
                } else {
                    ScrollView {
                        LazyVStack(spacing: 0) {
                            ForEach(library.sections) { section in
                                HStack(spacing: 10) {
                                    Image(systemName: "folder").font(.system(size: 16)).foregroundStyle(Palette.gold)
                                    Text(section.name)
                                        .font(.system(size: 15, weight: .semibold)).foregroundStyle(Palette.text)
                                    Spacer()
                                    Text("\(countFor(section.id))")
                                        .font(.system(size: 12)).foregroundStyle(Palette.textMuted)
                                        .padding(.trailing, 6)
                                    Button {
                                        library.removeSection(section.id)
                                    } label: {
                                        Image(systemName: "trash").font(.system(size: 16)).foregroundStyle(Palette.danger)
                                    }
                                    .buttonStyle(.plain)
                                }
                                .padding(.vertical, 12)
                                .overlay(alignment: .bottom) { Palette.border.frame(height: 1) }
                            }
                        }
                    }
                    .scrollIndicators(.hidden)
                }
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 32)
            .frame(maxHeight: .infinity, alignment: .top)
            .background(Palette.surfaceRaised.ignoresSafeArea())
            .navigationTitle("Sections")
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
    }

    private func handleAdd() {
        let trimmed = newName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        library.addSection(trimmed)
        newName = ""
    }

    // Group every cologne into a section named after its best-matching scent
    // family (the user's preferred families win ties). Unmatched bottles stay put.
    private func autoSortByScentType() {
        var slugsByFamily: [String: [String]] = [:]
        for item in library.collection {
            if let family = bestFamilyFor(item.notes, profile.profile.scentFamilies, SCENT_FAMILIES) {
                slugsByFamily[family, default: []].append(item.slug)
            }
        }
        if slugsByFamily.isEmpty { return }

        var nextSections = library.sections
        var sectionIdByFamily: [String: String] = [:]
        for family in slugsByFamily.keys {
            if let existing = nextSections.first(where: { $0.name.lowercased() == family.lowercased() }) {
                sectionIdByFamily[family] = existing.id
            } else {
                let id = "\(Int(nowMillis()))-\(family.filter { $0.isLetter })"
                nextSections.append(CollectionSection(id: id, name: family.capitalizedFirst))
                sectionIdByFamily[family] = id
            }
        }
        library.setSections(nextSections)
        for (family, slugs) in slugsByFamily {
            guard let sectionId = sectionIdByFamily[family] else { continue }
            for slug in slugs {
                library.updateCollectionItem(slug) { $0.sectionId = sectionId }
            }
        }
        dismiss()
    }
}
