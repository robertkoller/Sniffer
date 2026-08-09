import SwiftUI

// Owns the three stores and wires their dependencies once, mirroring the
// LibraryProvider > AuthProvider > ProfileProvider nesting in app/_layout.tsx.
@MainActor
final class AppState: ObservableObject {
    let library: LibraryStore
    let auth: AuthStore
    let profile: ProfileStore

    init() {
        let library = LibraryStore()
        let auth = AuthStore(library: library)
        let profile = ProfileStore(auth: auth)
        self.library = library
        self.auth = auth
        self.profile = profile
    }
}

@main
struct SniffyApp: App {
    @StateObject private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(appState.library)
                .environmentObject(appState.auth)
                .environmentObject(appState.profile)
                .preferredColorScheme(.dark)
                .tint(Palette.goldBright)
                .onOpenURL { url in
                    appState.auth.handleDeepLink(url)
                }
        }
    }
}
