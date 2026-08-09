import Foundation
import Combine

// Ported from context/ProfileContext.tsx. Local cache loads instantly; the
// server copy (per-account when signed in) overwrites it when reachable, and
// re-loads whenever the auth token changes so preferences follow the account.
@MainActor
final class ProfileStore: ObservableObject {
    @Published private(set) var profile = UserProfile()

    private let auth: AuthStore
    private var cancellables = Set<AnyCancellable>()

    private static let profileKey = "sniffy:profile"

    init(auth: AuthStore) {
        self.auth = auth

        if let cached = Store.load(UserProfile.self, key: Self.profileKey) {
            profile = cached
        }

        // Re-run on sign-in/out (mirrors the effect keyed on `token`)
        auth.$token
            .sink { [weak self] token in
                self?.reload(token: token)
            }
            .store(in: &cancellables)
    }

    private func reload(token: String?) {
        Task {
            if let serverProfile = try? await API.getProfile(token: token) {
                profile = serverProfile
                Store.save(serverProfile, key: Self.profileKey)
            }
        }
    }

    func updateProfile(genderPreference: GenderPreference? = nil, scentFamilies: [String]? = nil) {
        var next = profile
        if let genderPreference { next.genderPreference = genderPreference }
        if let scentFamilies { next.scentFamilies = scentFamilies }
        profile = next
        Store.save(next, key: Self.profileKey)
        let token = auth.token
        Task { try? await API.saveProfile(next, token: token) }
    }

    func toggleFamily(_ family: String) {
        if profile.scentFamilies.contains(family) {
            updateProfile(scentFamilies: profile.scentFamilies.filter { $0 != family })
        } else {
            updateProfile(scentFamilies: profile.scentFamilies + [family])
        }
    }
}
