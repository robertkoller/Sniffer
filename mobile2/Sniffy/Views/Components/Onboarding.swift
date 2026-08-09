import SwiftUI

// Ported from components/Onboarding.tsx. First-launch flow: taste questions
// first, then an account prompt.
struct OnboardingView: View {
    let onFinish: () -> Void

    @EnvironmentObject private var profile: ProfileStore
    @EnvironmentObject private var auth: AuthStore
    @Environment(\.openURL) private var openURL

    @State private var step = 0
    @State private var email = ""
    @State private var devError: String? = nil
    @State private var ageConfirmed = Store.loadString(key: "sniffy:ageConfirmed") != nil

    private struct GenderOption { let value: GenderPreference; let label: String; let caption: String }
    private let genderOptions: [GenderOption] = [
        .init(value: .men, label: "Men's", caption: "Show me masculine scents first"),
        .init(value: .women, label: "Women's", caption: "Show me feminine scents first"),
        .init(value: .all, label: "Everything", caption: "No preference — show it all"),
    ]

    var body: some View {
        ZStack {
            Palette.bg.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    HStack(spacing: 8) {
                        ForEach(0..<4, id: \.self) { dotIndex in
                            Capsule()
                                .fill(step == dotIndex ? Palette.gold : Palette.borderLight)
                                .frame(width: step == dotIndex ? 22 : 8, height: 8)
                        }
                    }
                    .padding(.bottom, 40)

                    switch step {
                    case 0: stepAge
                    case 1: stepGender
                    case 2: stepFamilies
                    default: stepAccount
                    }
                }
                .padding(28)
                .padding(.top, 24)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .scrollIndicators(.hidden)
        }
        // Signing in mid-flow counts as finishing
        .onChange(of: auth.user) { _, newUser in
            if newUser != nil && step == 3 { onFinish() }
        }
    }

    // MARK: - Steps

    private var stepAge: some View {
        VStack(alignment: .leading, spacing: 0) {
            kicker("BEFORE WE START")
            title("A quick check")
            caption("Sniffy is intended for people aged 13 and older. Please confirm your age. See our Privacy Policy for how your data is handled.")
            Button {
                ageConfirmed.toggle()
            } label: {
                HStack(spacing: 12) {
                    Image(systemName: ageConfirmed ? "checkmark.circle.fill" : "circle")
                        .font(.system(size: 22))
                        .foregroundStyle(ageConfirmed ? Palette.goldBright : Palette.textFaint)
                    Text("I'm 13 years old or older")
                        .font(.system(size: 15, weight: .semibold)).foregroundStyle(Palette.text)
                    Spacer()
                }
                .padding(18)
                .background(ageConfirmed ? Palette.surfaceGold : Palette.surface)
                .clipShape(RoundedRectangle(cornerRadius: Radius.md))
                .overlay(RoundedRectangle(cornerRadius: Radius.md).strokeBorder(ageConfirmed ? Palette.goldDim : Palette.border, lineWidth: 1))
            }
            .buttonStyle(.plain)
            .padding(.bottom, 10)

            privacyLink

            Button {
                guard ageConfirmed else { return }
                Store.saveString("1", key: "sniffy:ageConfirmed")
                step = 1
            } label: {
                HStack(spacing: 8) {
                    Text("CONTINUE").font(.system(size: 11, weight: .heavy)).tracking(1.2)
                    Image(systemName: "arrow.right").font(.system(size: 16))
                }
                .foregroundStyle(Palette.onGold)
                .frame(maxWidth: .infinity).padding(.vertical, 15)
                .background(Palette.gold).clipShape(Capsule())
            }
            .buttonStyle(.plain)
            .opacity(ageConfirmed ? 1 : 0.4)
            .disabled(!ageConfirmed)
            .padding(.top, 20)
        }
    }

    private var privacyLink: some View {
        Button {
            if let url = API.privacyURL { openURL(url) }
        } label: {
            Text("Privacy Policy")
                .font(.system(size: 13, weight: .semibold))
                .underline()
                .foregroundStyle(Palette.goldDim)
        }
        .buttonStyle(.plain)
        .frame(maxWidth: .infinity)
        .padding(.vertical, 6)
    }

    private var stepGender: some View {
        VStack(alignment: .leading, spacing: 0) {
            kicker("WELCOME TO SNIFFY")
            title("What do you wear?")
            caption("This shapes your search results — your side of the counter comes first.")
            ForEach(genderOptions, id: \.value) { option in
                let selected = profile.profile.genderPreference == option.value
                Button {
                    profile.updateProfile(genderPreference: option.value)
                } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(option.label)
                                .font(Fonts.serif(18))
                                .foregroundStyle(selected ? Palette.text : Palette.textSecondary)
                            Text(option.caption).font(.system(size: 12)).foregroundStyle(Palette.textMuted)
                        }
                        Spacer()
                        Image(systemName: selected ? "largecircle.fill.circle" : "circle")
                            .font(.system(size: 20))
                            .foregroundStyle(selected ? Palette.goldBright : Palette.textFaint)
                    }
                    .padding(18)
                    .background(selected ? Palette.surfaceGold : Palette.surface)
                    .clipShape(RoundedRectangle(cornerRadius: Radius.md))
                    .overlay(RoundedRectangle(cornerRadius: Radius.md).strokeBorder(selected ? Palette.goldDim : Palette.border, lineWidth: 1))
                }
                .buttonStyle(.plain)
                .padding(.bottom, 10)
            }
            nextButton("NEXT") { step = 2 }
            backLink { step = 0 }
        }
    }

    private var stepFamilies: some View {
        VStack(alignment: .leading, spacing: 0) {
            kicker("YOUR TASTE")
            title("What kind of scents do you like?")
            caption("Pick as many as you want — Sniffy flags fragrances that match.")
            FlowLayout(spacing: 10, lineSpacing: 10) {
                ForEach(SCENT_FAMILIES, id: \.self) { family in
                    let selected = profile.profile.scentFamilies.contains(family)
                    Button {
                        profile.toggleFamily(family)
                    } label: {
                        Text(family.capitalizedFirst)
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(selected ? Palette.goldBright : Palette.textMuted)
                            .padding(.horizontal, 16).padding(.vertical, 10)
                            .background(selected ? Palette.surfaceGold : Palette.surface)
                            .clipShape(Capsule())
                            .overlay(Capsule().strokeBorder(selected ? Palette.goldDim : Palette.border, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.bottom, 8)
            nextButton("NEXT") { step = 3 }
            backLink { step = 1 }
        }
    }

    private var stepAccount: some View {
        VStack(alignment: .leading, spacing: 0) {
            kicker("ONE LAST THING")
            title("Make it yours")
            caption("An account syncs your shelf and unlocks your public scent profile. It works on the Sniffer website too.")
            GoldPillButton(icon: "g.circle", title: "CONTINUE WITH GOOGLE", action: { auth.signInWithGoogle() }, verticalPadding: 15)

            if API.isDev {
                VStack(alignment: .leading, spacing: 0) {
                    SectionLabel(text: "DEV SIGN-IN", color: Palette.textFaint)
                        .padding(.top, 18).padding(.bottom, 8)
                    HStack(spacing: 8) {
                        TextField("", text: $email, prompt: Text("you@example.com").foregroundColor(Palette.textFaint))
                            .foregroundStyle(Palette.text)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .keyboardType(.emailAddress)
                            .submitLabel(.go)
                            .onSubmit(handleDevSignIn)
                            .padding(.horizontal, 16).frame(height: 44)
                            .background(Palette.surface).clipShape(Capsule())
                            .overlay(Capsule().strokeBorder(Palette.border, lineWidth: 1))
                        Button(action: handleDevSignIn) {
                            Image(systemName: "arrow.right").font(.system(size: 16)).foregroundStyle(Palette.onGold)
                                .frame(width: 44, height: 44).background(Palette.gold).clipShape(Circle())
                        }
                        .buttonStyle(.plain)
                    }
                    if let devError {
                        Text(devError).font(.system(size: 12)).foregroundStyle(Palette.danger).padding(.top, 8)
                    }
                }
            }

            Button { onFinish() } label: {
                Text("Skip for now").font(.system(size: 14, weight: .semibold)).foregroundStyle(Palette.goldDim)
                    .frame(maxWidth: .infinity).padding(.vertical, 18)
            }
            .buttonStyle(.plain)
            privacyLink
            backLink { step = 2 }
        }
    }

    // MARK: - Building blocks

    private func kicker(_ text: String) -> some View {
        Text(text).font(.system(size: 10, weight: .heavy)).tracking(2.5).foregroundStyle(Palette.gold)
            .padding(.bottom, 10)
    }
    private func title(_ text: String) -> some View {
        Text(text).font(Fonts.serif(32)).foregroundStyle(Palette.text).lineSpacing(4).padding(.bottom, 12)
    }
    private func caption(_ text: String) -> some View {
        Text(text).font(.system(size: 14)).foregroundStyle(Palette.textMuted).lineSpacing(4).padding(.bottom, 28)
    }
    private func nextButton(_ label: String, action: @escaping () -> Void) -> some View {
        GoldPillButton(icon: "arrow.right", title: label, action: action, verticalPadding: 15).padding(.top, 24)
    }
    private func backLink(action: @escaping () -> Void) -> some View {
        Button("Back", action: action)
            .font(.system(size: 13, weight: .semibold)).foregroundStyle(Palette.textMuted)
            .frame(maxWidth: .infinity).padding(.vertical, 14)
            .buttonStyle(.plain)
    }

    private func handleDevSignIn() {
        devError = nil
        let trimmed = email.trimmingCharacters(in: .whitespacesAndNewlines)
        Task {
            do {
                try await auth.signInDev(email: trimmed, name: trimmed.split(separator: "@").first.map(String.init) ?? "Sniffer")
                onFinish()
            } catch {
                devError = (error as? APIError)?.errorDescription ?? "Sign-in failed. Is the server running?"
            }
        }
    }
}
