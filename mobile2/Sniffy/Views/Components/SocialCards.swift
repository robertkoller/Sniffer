import SwiftUI

// Ported from components/SocialCards.tsx.

// Sign-in card (signed out) or identity card (signed in)
struct AccountCard: View {
    @EnvironmentObject private var auth: AuthStore
    @State private var email = ""
    @State private var devError: String? = nil

    var body: some View {
        if let user = auth.user {
            HStack(spacing: 14) {
                Avatar(name: user.name, picture: user.picture)
                VStack(alignment: .leading, spacing: 2) {
                    Text(user.name).font(Fonts.serif(20)).foregroundStyle(Palette.text)
                    Text(user.email).font(.system(size: 12)).foregroundStyle(Palette.textMuted)
                }
                Spacer(minLength: 0)
                Button { auth.signOut() } label: {
                    Image(systemName: "rectangle.portrait.and.arrow.right")
                        .font(.system(size: 18)).foregroundStyle(Palette.textMuted)
                        .frame(width: 36, height: 36).background(Palette.surfaceRaised).clipShape(Circle())
                }
                .buttonStyle(.plain)
            }
            .sniffyCard()
        } else {
            VStack(alignment: .leading, spacing: 0) {
                Text("Join the club").font(Fonts.serif(21)).foregroundStyle(Palette.text)
                    .padding(.bottom, 6)
                Text("Sign in to sync your shelf and share your scent profile. The same account works on the Sniffer website.")
                    .font(.system(size: 13)).foregroundStyle(Palette.textMuted).lineSpacing(3)
                    .padding(.bottom, 14)
                GoldPillButton(icon: "g.circle", title: "CONTINUE WITH GOOGLE") { auth.signInWithGoogle() }

                if API.isDev {
                    VStack(alignment: .leading, spacing: 0) {
                        SectionLabel(text: "DEV SIGN-IN", color: Palette.textFaint)
                            .padding(.top, 14).padding(.bottom, 8)
                        HStack(spacing: 8) {
                            TextField("", text: $email, prompt: Text("you@example.com").foregroundColor(Palette.textFaint))
                                .foregroundStyle(Palette.text)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                                .keyboardType(.emailAddress)
                                .submitLabel(.go)
                                .onSubmit(handleDevSignIn)
                                .padding(.horizontal, 14).frame(height: 40)
                                .background(Palette.surfaceRaised).clipShape(Capsule())
                                .overlay(Capsule().strokeBorder(Palette.border, lineWidth: 1))
                            Button(action: handleDevSignIn) {
                                Image(systemName: "arrow.right").font(.system(size: 16)).foregroundStyle(Palette.onGold)
                                    .frame(width: 40, height: 40).background(Palette.gold).clipShape(Circle())
                            }
                            .buttonStyle(.plain)
                        }
                        if let devError {
                            Text(devError).font(.system(size: 12)).foregroundStyle(Palette.danger).padding(.top, 8)
                        }
                    }
                }
            }
            .sniffyCard()
        }
    }

    private func handleDevSignIn() {
        devError = nil
        let trimmed = email.trimmingCharacters(in: .whitespacesAndNewlines)
        Task {
            do {
                try await auth.signInDev(email: trimmed, name: trimmed.split(separator: "@").first.map(String.init) ?? "Sniffer")
            } catch {
                devError = (error as? APIError)?.errorDescription ?? "Sign-in failed. Is the server running?"
            }
        }
    }
}

// "Currently wearing" card with a picker over the collection
struct CurrentlyWearingCard: View {
    @EnvironmentObject private var library: LibraryStore
    @State private var pickerVisible = false

    private var wearingItem: CollectionItem? {
        guard let slug = library.currentlyWearing else { return nil }
        return library.collection.first { $0.slug == slug }
    }

    var body: some View {
        if library.collection.isEmpty {
            EmptyView()
        } else {
            VStack(alignment: .leading, spacing: 12) {
                CardHeaderLabel(icon: "drop", text: "CURRENTLY WEARING")
                if let wearingItem {
                    HStack(spacing: 12) {
                        RemoteImage(url: wearingItem.imageUrl, width: 48, height: 62, fallbackIconSize: 18)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(wearingItem.brand).itemBrandStyle()
                            Text(wearingItem.name).font(Fonts.serif(18)).foregroundStyle(Palette.text).lineLimit(1)
                        }
                        Spacer(minLength: 0)
                        Button("Change") { pickerVisible = true }
                            .font(.system(size: 13, weight: .semibold)).foregroundStyle(Palette.goldBright)
                            .buttonStyle(.plain)
                    }
                } else {
                    Button { pickerVisible = true } label: {
                        HStack(spacing: 8) {
                            Image(systemName: "plus").font(.system(size: 16))
                            Text("What are you wearing today?").font(.system(size: 13, weight: .semibold))
                        }
                        .foregroundStyle(Palette.goldBright)
                        .frame(maxWidth: .infinity).padding(.vertical, 12)
                        .overlay(Capsule().strokeBorder(Palette.goldDim, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
            }
            .sniffyCard()
            .sheet(isPresented: $pickerVisible) {
                WearingPicker(pickerVisible: $pickerVisible)
            }
        }
    }
}

private struct WearingPicker: View {
    @EnvironmentObject private var library: LibraryStore
    @Binding var pickerVisible: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Today's scent").font(Fonts.serif(21)).foregroundStyle(Palette.text)
                .padding(.bottom, 14)
            ScrollView {
                LazyVStack(spacing: 0) {
                    ForEach(library.collection) { item in
                        Button {
                            library.setCurrentlyWearing(item.slug)
                            pickerVisible = false
                        } label: {
                            pickerRow(item, selected: library.currentlyWearing == item.slug)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .scrollIndicators(.hidden)
            if library.currentlyWearing != nil {
                Button {
                    library.setCurrentlyWearing(nil)
                    pickerVisible = false
                } label: {
                    Text("Clear — not wearing anything")
                        .font(.system(size: 13, weight: .semibold)).foregroundStyle(Palette.danger)
                        .frame(maxWidth: .infinity).padding(.top, 16)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(20)
        .padding(.bottom, 12)
        .frame(maxHeight: .infinity, alignment: .top)
        .background(Palette.surfaceRaised.ignoresSafeArea())
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    private func pickerRow(_ item: CollectionItem, selected: Bool) -> some View {
        HStack(spacing: 12) {
            RemoteImage(url: item.imageUrl, width: 36, height: 46, fallbackIconSize: 14)
            VStack(alignment: .leading, spacing: 2) {
                Text(item.brand).itemBrandStyle()
                Text(item.name).font(Fonts.serif(16)).foregroundStyle(Palette.text).lineLimit(1)
            }
            Spacer(minLength: 0)
            if selected {
                Image(systemName: "checkmark").font(.system(size: 18)).foregroundStyle(Palette.goldBright)
            }
        }
        .padding(.vertical, 10)
        .overlay(alignment: .bottom) { Palette.border.frame(height: 1) }
    }
}

// The display shelf: up to 10 hand-picked bottles (falls back to top rated
// until the user curates their own).
struct ShowcaseShelf: View {
    @EnvironmentObject private var library: LibraryStore
    @State private var editVisible = false

    private var curated: [CollectionItem] {
        library.showcaseSlugs.compactMap { slug in library.collection.first { $0.slug == slug } }
    }
    private var fallback: [CollectionItem] {
        Array(library.collection
            .filter { ($0.rating ?? 0) > 0 }
            .sorted { a, b in
                let byRating = (a.rating ?? 0) - (b.rating ?? 0)
                if byRating != 0 { return byRating > 0 }
                return (a.wearCount ?? 0) > (b.wearCount ?? 0)
            }
            .prefix(10))
    }
    private var shelf: [CollectionItem] { curated.isEmpty ? fallback : curated }

    var body: some View {
        if library.collection.isEmpty {
            EmptyView()
        } else {
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    CardHeaderLabel(icon: "sparkles", text: "SHOWCASE")
                    Spacer()
                    Button(curated.isEmpty ? "Choose" : "Edit") { editVisible = true }
                        .font(.system(size: 13, weight: .semibold)).foregroundStyle(Palette.goldBright)
                        .buttonStyle(.plain)
                }
                .padding(.bottom, 12)

                if shelf.isEmpty {
                    Text("Pick up to 10 bottles to show off on your profile.")
                        .font(.system(size: 13)).foregroundStyle(Palette.textMuted).lineSpacing(3)
                } else {
                    if curated.isEmpty {
                        Text("Showing your top rated — tap Choose to curate your own shelf.")
                            .font(.system(size: 11)).foregroundStyle(Palette.textFaint)
                            .padding(.bottom, 10)
                    }
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(alignment: .top, spacing: 14) {
                            ForEach(Array(shelf.enumerated()), id: \.element.slug) { index, item in
                                shelfItem(item, rank: index + 1)
                            }
                        }
                        .padding(.trailing, 6)
                    }
                }
            }
            .sniffyCard()
            .sheet(isPresented: $editVisible) {
                ShowcasePicker(editVisible: $editVisible)
            }
        }
    }

    private func shelfItem(_ item: CollectionItem, rank: Int) -> some View {
        VStack(spacing: 0) {
            RemoteImage(url: item.imageUrl, width: 76, height: 100, fallbackIconSize: 20)
                .overlay(alignment: .topLeading) {
                    Text("\(rank)")
                        .font(Fonts.serif(12)).foregroundStyle(Palette.onGold)
                        .frame(width: 24, height: 24).background(Palette.gold).clipShape(Circle())
                        .offset(x: -6, y: -6)
                }
            Text(item.name).font(.system(size: 11, weight: .semibold)).foregroundStyle(Palette.textSecondary)
                .lineLimit(1).frame(maxWidth: 92).padding(.top, 6)
            if let rating = item.rating, rating > 0 {
                Text(String(format: "%.1f", rating)).font(Fonts.serif(12)).foregroundStyle(Palette.goldBright).padding(.top, 2)
            }
            if let notes = item.notes, !notes.top.isEmpty {
                Text(notes.top.prefix(3).joined(separator: " · "))
                    .font(.system(size: 9)).foregroundStyle(Palette.textFaint)
                    .multilineTextAlignment(.center).lineLimit(2).lineSpacing(1).padding(.top, 2)
            }
        }
        .frame(width: 92)
    }
}

private struct ShowcasePicker: View {
    @EnvironmentObject private var library: LibraryStore
    @Binding var editVisible: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Curate your showcase").font(Fonts.serif(21)).foregroundStyle(Palette.text)
                .padding(.bottom, 6)
            Text("\(library.showcaseSlugs.count)/10 chosen — tap to add or remove, in the order you want them shown.")
                .font(.system(size: 12)).foregroundStyle(Palette.textMuted)
                .padding(.bottom, 12)
            ScrollView {
                LazyVStack(spacing: 0) {
                    ForEach(library.collection) { item in
                        let position = library.showcaseSlugs.firstIndex(of: item.slug)
                        Button {
                            library.toggleShowcase(item.slug)
                        } label: {
                            HStack(spacing: 12) {
                                RemoteImage(url: item.imageUrl, width: 36, height: 46, fallbackIconSize: 14)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(item.brand).itemBrandStyle()
                                    Text(item.name).font(Fonts.serif(16)).foregroundStyle(Palette.text).lineLimit(1)
                                }
                                Spacer(minLength: 0)
                                if let position {
                                    Text("\(position + 1)")
                                        .font(Fonts.serif(12)).foregroundStyle(Palette.onGold)
                                        .frame(width: 24, height: 24).background(Palette.gold).clipShape(Circle())
                                } else {
                                    Image(systemName: "plus.circle").font(.system(size: 20)).foregroundStyle(Palette.textFaint)
                                }
                            }
                            .padding(.vertical, 10)
                            .overlay(alignment: .bottom) { Palette.border.frame(height: 1) }
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .scrollIndicators(.hidden)
            GoldPillButton(icon: nil, title: "DONE") { editVisible = false }
                .padding(.top, 14)
        }
        .padding(20)
        .padding(.bottom, 12)
        .frame(maxHeight: .infinity, alignment: .top)
        .background(Palette.surfaceRaised.ignoresSafeArea())
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
    }
}
