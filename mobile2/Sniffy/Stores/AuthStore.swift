import Foundation
import Combine
import UIKit

// Ported from context/AuthContext.tsx. Holds the session, handles Google/dev
// sign-in and the deep-link callback, and keeps the server library in sync.
@MainActor
final class AuthStore: ObservableObject {
    @Published private(set) var user: AuthUser? = nil
    @Published private(set) var token: String? = nil

    private let library: LibraryStore
    private var cancellables = Set<AnyCancellable>()

    private enum Key {
        static let token = "sniffy:authToken"
        static let user = "sniffy:authUser"
    }

    // The Google flow returns here: sniffy://auth?token=…
    static let deepLinkReturnUrl = "sniffy://auth"

    init(library: LibraryStore) {
        self.library = library
        restoreSession()
        setupServerSync()
    }

    private func adoptSession(token nextToken: String, user nextUser: AuthUser) {
        token = nextToken
        user = nextUser
        Store.saveString(nextToken, key: Key.token)
        Store.save(nextUser, key: Key.user)

        // Wear dates are server-authoritative — adopt the account's history
        Task {
            if let wears = try? await API.fetchWearHistory(token: nextToken), !wears.isEmpty {
                library.replaceWearLog(wears.map { WearEvent(slug: $0.slug, date: $0.wornOn) })
            }
        }

        // Account restore: if this device has no library but the account does,
        // pull the server copy so the app comes back exactly as it was.
        if library.loaded && library.collection.isEmpty && library.wishlist.isEmpty {
            Task {
                guard let snapshot = try? await API.fetchLibrarySnapshot(token: nextToken) else { return }
                let hasCollection = (snapshot.collection?.count ?? 0) > 0
                let hasWishlist = (snapshot.wishlist?.count ?? 0) > 0
                if !hasCollection && !hasWishlist {
                    return
                }
                library.hydrateFromServer(snapshot)
            }
        }
    }

    // Restore the session, then re-validate against the server
    private func restoreSession() {
        guard let storedToken = Store.loadString(key: Key.token) else { return }
        token = storedToken
        if let storedUser = Store.load(AuthUser.self, key: Key.user) {
            user = storedUser
        }
        Task {
            do {
                let freshUser = try await API.fetchMe(token: storedToken)
                adoptSession(token: storedToken, user: freshUser)
            } catch {
                // Token invalid/expired — clear the session
                token = nil
                user = nil
                Store.remove(key: Key.token)
                Store.remove(key: Key.user)
            }
        }
    }

    // Called from .onOpenURL when the Google flow deep-links back into the app
    func handleDeepLink(_ url: URL) {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let deepLinkToken = components.queryItems?.first(where: { $0.name == "token" })?.value,
              !deepLinkToken.isEmpty else {
            return
        }
        Task {
            if let freshUser = try? await API.fetchMe(token: deepLinkToken) {
                adoptSession(token: deepLinkToken, user: freshUser)
            }
        }
    }

    func signInWithGoogle() {
        guard let url = API.googleSignInUrl(returnUrl: Self.deepLinkReturnUrl) else { return }
        UIApplication.shared.open(url)
    }

    func signInDev(email: String, name: String) async throws {
        let session = try await API.devSignIn(email: email, name: name)
        adoptSession(token: session.token, user: session.user)
    }

    func signOut() {
        if let token {
            Task { await API.signOutServer(token: token) }
        }
        token = nil
        user = nil
        Store.remove(key: Key.token)
        Store.remove(key: Key.user)
    }

    // Keep the server copy of the library fresh (drives the social profile).
    // Debounced so rapid edits (ratings, wears) collapse into one push.
    private func setupServerSync() {
        let libraryChanged = library.objectWillChange.map { _ in () }
        let tokenChanged = $token.map { _ in () }

        libraryChanged
            .merge(with: tokenChanged)
            .debounce(for: .seconds(2), scheduler: DispatchQueue.main)
            .sink { [weak self] in
                guard let self, let token = self.token, self.library.loaded else { return }
                let payload = API.LibraryPushPayload(
                    collection: self.library.collection,
                    wishlist: self.library.wishlist,
                    currentlyWearingSlug: self.library.currentlyWearing,
                    showcaseSlugs: self.library.showcaseSlugs,
                    sections: self.library.sections,
                    complimentLog: self.library.complimentLog
                )
                Task { await API.pushLibrarySnapshot(token: token, payload: payload) }
            }
            .store(in: &cancellables)
    }
}
