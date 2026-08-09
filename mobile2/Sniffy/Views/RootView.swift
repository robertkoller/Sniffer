import SwiftUI

// Tab shell + first-launch onboarding overlay (app/_layout.tsx).
struct RootView: View {
    @State private var onboardingDone = Store.loadString(key: "sniffy:onboarded") != nil

    var body: some View {
        TabView {
            DiscoverView()
                .tabItem { Label("Discover", systemImage: "magnifyingglass") }
            CollectionView()
                .tabItem { Label("Collection", systemImage: "square.stack.fill") }
            WishlistView()
                .tabItem { Label("Wishlist", systemImage: "bookmark.fill") }
            RankingsView()
                .tabItem { Label("Rankings", systemImage: "chart.bar.fill") }
            ProfileView()
                .tabItem { Label("Profile", systemImage: "person.fill") }
        }
        .tint(Palette.goldBright)
        .fullScreenCover(isPresented: Binding(
            get: { !onboardingDone },
            set: { finished in if finished { onboardingDone = true } }
        )) {
            OnboardingView(onFinish: {
                Store.saveString("1", key: "sniffy:onboarded")
                onboardingDone = true
            })
        }
        .onAppear {
            // Match the gold accent on the tab bar background.
            let appearance = UITabBarAppearance()
            appearance.configureWithOpaqueBackground()
            appearance.backgroundColor = UIColor(Palette.surface)
            UITabBar.appearance().standardAppearance = appearance
            UITabBar.appearance().scrollEdgeAppearance = appearance
        }
    }
}
