# Sniffy — Native iOS App (Swift)

A native **SwiftUI** rewrite of the React Native app, in `mobile2/`. Same backend, same behavior, same dark-gold design — a 1:1 port of `mobile/` (see [mobile-app.md](mobile-app.md)) built for iOS. Targets iOS 17+, bundle id `com.sniffy.app`.

## Project layout

```
mobile2/
  Sniffy.xcodeproj/      hand-written pbxproj (objectVersion 77)
  run.sh                 build + boot sim + install + launch, no Xcode GUI
  Sniffy/
    SniffyApp.swift      @main; AppState wires the three stores + onOpenURL deep link
    Info.plist           URL scheme (sniffy://), portrait, dark, ATS localhost
    Theme/Theme.swift     colors/radii/spacing/fonts (port of constants/theme.ts)
    Models/Models.swift   all types.ts structs as Codable
    Services/APIService.swift   every server call (port of services/api.ts)
    Stores/               LibraryStore / AuthStore / ProfileStore (the RN contexts)
    Utils/                slug, taste, date helpers, Persistence (UserDefaults)
    Views/                screens + Views/Components/ (the RN components)
    Assets.xcassets/      AppIcon, AccentColor, LaunchBackground
```

### The Xcode project is hand-written

`project.pbxproj` uses a **file-system–synchronized root group** (`PBXFileSystemSynchronizedRootGroup`), so **new `.swift` files under `Sniffy/` are picked up automatically** — no pbxproj edits. `Info.plist` is excluded from the resource copy via a `PBXFileSystemSynchronizedBuildFileExceptionSet` (otherwise you get "Multiple commands produce Info.plist").

## State — three stores (the RN contexts)

RN Contexts → SwiftUI `ObservableObject`s, wired once in `AppState` and injected via `.environmentObject`:

| Store | Mirrors | Responsibility |
|-------|---------|----------------|
| `LibraryStore` | `LibraryContext` | collection, wishlist, sections, showcase, currently-wearing, wear/compliment logs; persists to `UserDefaults`; account restore via `hydrateFromServer` |
| `AuthStore` | `AuthContext` | session token + user, Google sign-in, dev login, `onOpenURL` deep-link capture, debounced library sync (Combine, 2s) |
| `ProfileStore` | `ProfileContext` | taste profile, synced with `/api/profile`, re-loads on token change |

## Screens & components

Screens in `Views/` (`DiscoverView`, `CollectionView`, `WishlistView`, `RankingsView`, `ProfileView`) map to the RN tab screens; `RootView` is the `TabView` + onboarding cover. Components in `Views/Components/` port their RN counterparts (`FragranceCard`, `FragranceDetailSheet`, `AddFragranceModal`, `NotesPyramid`, `RatingSlider`, `LibraryRow`, `SectionManager`, `SocialCards`, `WearCharts`, `Onboarding`, `TagPills`, `EmptyState`, `ScreenHeader`, `Avatar`). Two extras exist because SwiftUI lacks them: `FlowLayout` (wrapping chip rows, RN's `flexWrap`) and `RemoteImage` (async image with white backing + flask fallback, RN's `expo-image`).

## Persistence — same keys as the RN app

`UserDefaults` stands in for AsyncStorage under the **identical `sniffy:*` keys** (`sniffy:collection`, `…:wishlist`, `…:sections`, `…:showcase`, `…:currentlyWearing`, `…:wearLog`, `…:complimentLog`, `…:profile`, `…:recentSearches`, `…:onboarded`, `…:ageConfirmed`, `…:authToken`, `…:authUser`). Signed-in libraries sync to the server for cross-device restore.

## Config

`API` in `APIService.swift` uses `#if DEBUG` to pick `http://localhost:3001` (dev) vs the VPS (release), mirroring the RN `__DEV__` split. `API.privacyURL` → `<baseURL>/privacy`. Deep link is `sniffy://auth` (registered in `Info.plist`), matching the OAuth return in [authentication.md](authentication.md).

## Age gate

First onboarding step is the 13+ age gate (see [privacy-and-age-gate.md](privacy-and-age-gate.md)); Continue is disabled until confirmed, and Settings has a Privacy Policy link.

## Running without Xcode GUI

```
cd mobile2
./run.sh        # DEVICE_NAME="iPhone 16 Pro" ./run.sh to override the simulator
```

It boots a simulator, opens the Simulator window, builds, installs, and launches — terminal only. You still need **Xcode installed** (the iOS SDK/toolchain), but you never open the GUI. For a physical device you'd add signing (easiest to set up once in Xcode). See the notes in the session that created it; the RN app remains the shippable one via `eas`, while this is the native track.

## Relationship to the RN app

They're intended to stay **feature-identical**. If one changes, mirror it in the other. Both talk to the same API with the same slugs and storage keys, so a user's account restores identically on either.
