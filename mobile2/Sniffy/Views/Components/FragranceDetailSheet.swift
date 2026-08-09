import SwiftUI

// Ported from components/FragranceDetailSheet.tsx. Rating, wear + compliment
// logging (collection only), section picker, seasons/occasions, notes, review,
// and remove / "got it" actions.
struct FragranceDetailSheet: View {
    let item: SavedFragrance
    let mode: LibraryMode
    let onClose: () -> Void

    @EnvironmentObject private var library: LibraryStore
    @EnvironmentObject private var auth: AuthStore
    @Environment(\.dismiss) private var dismiss

    @State private var reviewDraft = ""
    @State private var loggingWear = false
    @State private var alreadyLoggedAlert = false
    @State private var alertMessage = ""

    // Always read the freshest copy from the store so edits reflect live.
    private var current: SavedFragrance {
        (mode == .collection ? library.collection : library.wishlist).first { $0.slug == item.slug } ?? item
    }

    private func update(_ patch: @escaping (inout SavedFragrance) -> Void) {
        if mode == .collection {
            library.updateCollectionItem(item.slug, patch)
        } else {
            library.updateWishlistItem(item.slug, patch)
        }
    }

    private var wornToday: Bool {
        guard let lastWornAt = current.lastWornAt else { return false }
        return isToday(millis: lastWornAt)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    titleRow
                    section {
                        RatingSlider(
                            rating: current.rating ?? 0,
                            onChange: { value in update { $0.rating = value > 0 ? value : nil } },
                            label: mode == .collection ? "YOUR RATING" : "HOW BADLY DO YOU WANT IT"
                        )
                    }

                    if mode == .collection {
                        wearLogSection
                        complimentsSection
                        if !library.sections.isEmpty { sectionPicker }
                    }

                    section {
                        SectionLabel(text: "SEASONS")
                        TagPills(options: SEASONS, selected: current.seasons ?? [], onToggle: toggleSeason)
                    }
                    section {
                        SectionLabel(text: "OCCASIONS")
                        TagPills(options: OCCASIONS, selected: current.occasions ?? [], onToggle: toggleOccasion)
                    }

                    if let notes = current.notes {
                        section {
                            SectionLabel(text: "NOTES")
                            NotesPyramid(notes: notes, noteImages: current.noteImages)
                        }
                    }

                    section {
                        SectionLabel(text: mode == .collection ? "YOUR REVIEW" : "WHY YOU WANT IT")
                        reviewField
                    }

                    if mode == .wishlist {
                        GoldPillButton(icon: "checkmark.circle.fill", title: "GOT IT — MOVE TO COLLECTION", action: handleGotIt, verticalPadding: 14)
                            .padding(.top, 26)
                    }

                    Button(action: handleRemove) {
                        HStack(spacing: 6) {
                            Image(systemName: "trash").font(.system(size: 15))
                            Text("Remove from \(mode == .collection ? "collection" : "wishlist")")
                                .font(.system(size: 13, weight: .semibold))
                        }
                        .foregroundStyle(Palette.danger)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                    }
                    .buttonStyle(.plain)
                    .padding(.top, 8)
                }
                .padding(22)
                .padding(.bottom, 22)
            }
            .scrollIndicators(.hidden)
            .background(Palette.surfaceRaised.ignoresSafeArea())
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { onClose(); dismiss() } label: {
                        Image(systemName: "xmark").font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(Palette.textMuted)
                    }
                }
            }
        }
        .presentationDragIndicator(.visible)
        .presentationDetents([.large])
        .onAppear { reviewDraft = current.review ?? "" }
        .alert("Already logged", isPresented: $alreadyLoggedAlert) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(alertMessage)
        }
    }

    // MARK: - Sections

    private var titleRow: some View {
        HStack(alignment: .top, spacing: 14) {
            if current.imageUrl != nil {
                RemoteImage(url: current.imageUrl, width: 64, height: 84)
            }
            VStack(alignment: .leading, spacing: 5) {
                Text(current.brand).eyebrowStyle()
                Text(current.name)
                    .font(Fonts.serif(26)).foregroundStyle(Palette.text)
                Text("\(mode == .collection ? "In collection" : "Wishlisted") since \(formatDate(current.addedAt))")
                    .font(.system(size: 12)).foregroundStyle(Palette.textMuted)
            }
            Spacer(minLength: 0)
        }
    }

    private var wearLogSection: some View {
        section {
            SectionLabel(text: "WEAR LOG")
            HStack {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text("\(current.wearCount ?? 0)")
                        .font(Fonts.serif(28)).foregroundStyle(Palette.goldBright)
                    Text("\((current.wearCount ?? 0) == 1 ? "wear" : "wears")\(current.lastWornAt.map { " · last \(formatDate($0))" } ?? "")")
                        .font(.system(size: 12)).foregroundStyle(Palette.textMuted)
                }
                Spacer()
                Button(action: handleLogWear) {
                    HStack(spacing: 5) {
                        Image(systemName: wornToday ? "checkmark" : "plus").font(.system(size: 16))
                        Text(wornToday ? "LOGGED TODAY" : (loggingWear ? "LOGGING…" : "WORE IT TODAY"))
                            .font(.system(size: 10, weight: .heavy)).tracking(1.2)
                    }
                    .foregroundStyle(Palette.onGold)
                    .padding(.horizontal, 14).padding(.vertical, 9)
                    .background(Palette.gold).clipShape(Capsule())
                    .opacity(wornToday || loggingWear ? 0.4 : 1)
                }
                .buttonStyle(.plain)
                .disabled(wornToday || loggingWear)
            }
        }
    }

    private var complimentsSection: some View {
        let total = library.complimentLog.filter { $0.slug == item.slug }.reduce(0) { $0 + $1.count }
        let todayKey = todayString()
        let todayCount = library.complimentLog.filter { $0.slug == item.slug && $0.date == todayKey }.reduce(0) { $0 + $1.count }
        return section {
            SectionLabel(text: "COMPLIMENTS")
            HStack {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text("\(total)").font(Fonts.serif(28)).foregroundStyle(Palette.goldBright)
                    Text("total\(todayCount > 0 ? " · \(todayCount) today" : "")")
                        .font(.system(size: 12)).foregroundStyle(Palette.textMuted)
                }
                Spacer()
                Button {
                    library.addCompliment(item.slug)
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "heart.fill").font(.system(size: 15))
                        Text("GOT A COMPLIMENT").font(.system(size: 10, weight: .heavy)).tracking(1.2)
                    }
                    .foregroundStyle(Palette.onGold)
                    .padding(.horizontal, 14).padding(.vertical, 9)
                    .background(Palette.gold).clipShape(Capsule())
                    .opacity(wornToday ? 1 : 0.4)
                }
                .buttonStyle(.plain)
                .disabled(!wornToday)
            }
            if !wornToday {
                Text("Log a wear today to track compliments — you can't get one without wearing it.")
                    .font(.system(size: 11)).foregroundStyle(Palette.textFaint).lineSpacing(3)
            }
        }
    }

    private var sectionPicker: some View {
        section {
            SectionLabel(text: "SECTION")
            FlowLayout(spacing: 8) {
                sectionChip(name: "None", selected: current.sectionId == nil) {
                    update { $0.sectionId = nil }
                }
                ForEach(library.sections) { sec in
                    sectionChip(name: sec.name, selected: current.sectionId == sec.id) {
                        update { $0.sectionId = sec.id }
                    }
                }
            }
        }
    }

    private func sectionChip(name: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(name)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(selected ? Palette.goldBright : Palette.textMuted)
                .padding(.horizontal, 14).padding(.vertical, 7)
                .background(selected ? Palette.surfaceGold : Color.clear)
                .clipShape(Capsule())
                .overlay(Capsule().strokeBorder(selected ? Palette.goldDim : Palette.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private var reviewField: some View {
        TextField(
            mode == .collection ? "Projection, longevity, compliments…" : "Where you smelled it, what it reminds you of…",
            text: $reviewDraft,
            axis: .vertical
        )
        .lineLimit(4...)
        .font(.system(size: 14))
        .foregroundStyle(Palette.text)
        .padding(14)
        .frame(minHeight: 90, alignment: .topLeading)
        .background(Palette.surface)
        .clipShape(RoundedRectangle(cornerRadius: Radius.md))
        .overlay(RoundedRectangle(cornerRadius: Radius.md).strokeBorder(Palette.border, lineWidth: 1))
        .onChange(of: reviewDraft) { _, _ in }
        .onSubmit(saveReview)
        .submitLabel(.done)
        .onDisappear(perform: saveReview)
    }

    // MARK: - Section wrapper

    @ViewBuilder
    private func section<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, 22)
    }

    // MARK: - Actions

    private func toggleSeason(_ value: String) {
        let currentSeasons = current.seasons ?? []
        let next = currentSeasons.contains(value) ? currentSeasons.filter { $0 != value } : currentSeasons + [value]
        update { $0.seasons = next }
    }

    private func toggleOccasion(_ value: String) {
        let currentOccasions = current.occasions ?? []
        let next = currentOccasions.contains(value) ? currentOccasions.filter { $0 != value } : currentOccasions + [value]
        update { $0.occasions = next }
    }

    private func saveReview() {
        let trimmed = reviewDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        update { $0.review = trimmed.isEmpty ? nil : trimmed }
    }

    private func handleRemove() {
        if mode == .collection {
            library.removeFromCollection(item.slug)
        } else {
            library.removeFromWishlist(item.slug)
        }
        onClose()
        dismiss()
    }

    private func handleGotIt() {
        library.moveToCollection(item.slug)
        onClose()
        dismiss()
    }

    // One wear per fragrance per day. Signed in, the server is the referee;
    // signed out, the local last-worn date enforces the same rule.
    private func handleLogWear() {
        guard !loggingWear, !wornToday else { return }
        guard let token = auth.token else {
            library.logWear(item.slug)
            return
        }
        loggingWear = true
        Task {
            do {
                _ = try await API.logWearOnServer(token: token, slug: item.slug)
                library.logWear(item.slug)
            } catch {
                alertMessage = (error as? APIError)?.errorDescription ?? "You already logged a wear for this today."
                alreadyLoggedAlert = true
                library.updateCollectionItem(item.slug) { $0.lastWornAt = nowMillis() }
            }
            loggingWear = false
        }
    }
}

private func formatDate(_ millis: Double) -> String {
    let formatter = DateFormatter()
    formatter.dateFormat = "MMM d, yyyy"
    return formatter.string(from: Date(timeIntervalSince1970: millis / 1000))
}
