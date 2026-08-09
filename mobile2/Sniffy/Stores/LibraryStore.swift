import Foundation
import Combine

// Ported from context/LibraryContext.tsx. Owns the collection, wishlist,
// showcase, sections, and the wear/compliment logs, all persisted locally.
@MainActor
final class LibraryStore: ObservableObject {
    @Published private(set) var collection: [CollectionItem] = []
    @Published private(set) var wishlist: [WishlistItem] = []
    @Published private(set) var currentlyWearing: String? = nil // slug of a collection item
    @Published private(set) var showcaseSlugs: [String] = []    // user-curated display shelf (max 10)
    @Published private(set) var sections: [CollectionSection] = []
    @Published private(set) var wearLog: [WearEvent] = []
    @Published private(set) var complimentLog: [ComplimentEvent] = []
    @Published private(set) var loaded = false

    private enum Key {
        static let collection = "sniffy:collection"
        static let wishlist = "sniffy:wishlist"
        static let wearing = "sniffy:currentlyWearing"
        static let showcase = "sniffy:showcase"
        static let sections = "sniffy:sections"
        static let wearLog = "sniffy:wearLog"
        static let complimentLog = "sniffy:complimentLog"
        static let ratingScale = "sniffy:ratingsV2" // set once ratings are on the 0–10 scale
    }

    init() {
        load()
    }

    // Legacy ratings were 1–5 stars; the app now uses 0–10 with one decimal
    private func migrateRatings(_ items: [SavedFragrance]) -> [SavedFragrance] {
        items.map { item in
            guard let rating = item.rating else { return item }
            var copy = item
            copy.rating = min(rating * 2, 10)
            return copy
        }
    }

    private func load() {
        let needsRatingMigration = Store.loadString(key: Key.ratingScale) == nil

        if var items = Store.load([CollectionItem].self, key: Key.collection) {
            if needsRatingMigration {
                items = migrateRatings(items)
                Store.save(items, key: Key.collection)
            }
            collection = items
        }
        if var items = Store.load([WishlistItem].self, key: Key.wishlist) {
            if needsRatingMigration {
                items = migrateRatings(items)
                Store.save(items, key: Key.wishlist)
            }
            wishlist = items
        }
        if needsRatingMigration {
            Store.saveString("1", key: Key.ratingScale)
        }
        currentlyWearing = Store.loadString(key: Key.wearing)
        showcaseSlugs = Store.load([String].self, key: Key.showcase) ?? []
        sections = Store.load([CollectionSection].self, key: Key.sections) ?? []
        wearLog = Store.load([WearEvent].self, key: Key.wearLog) ?? []
        complimentLog = Store.load([ComplimentEvent].self, key: Key.complimentLog) ?? []
        loaded = true
    }

    // Wear / compliment logs

    // Used after sign-in to adopt the server's authoritative wear history
    func replaceWearLog(_ events: [WearEvent]) {
        wearLog = events
        Store.save(events, key: Key.wearLog)
    }

    func addCompliment(_ slug: String) {
        let today = todayString()
        if let index = complimentLog.firstIndex(where: { $0.slug == slug && $0.date == today }) {
            complimentLog[index].count += 1
        } else {
            complimentLog.append(ComplimentEvent(slug: slug, date: today, count: 1))
        }
        Store.save(complimentLog, key: Key.complimentLog)
    }

    // Sections

    func setSections(_ next: [CollectionSection]) {
        sections = next
        Store.save(next, key: Key.sections)
    }

    func addSection(_ name: String) {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        if sections.contains(where: { $0.name.lowercased() == trimmed.lowercased() }) || sections.count >= 30 {
            return
        }
        let id = "\(Int(nowMillis()))-\(String(UUID().uuidString.prefix(5)).lowercased())"
        sections.append(CollectionSection(id: id, name: trimmed))
        Store.save(sections, key: Key.sections)
    }

    func removeSection(_ id: String) {
        sections.removeAll { $0.id == id }
        Store.save(sections, key: Key.sections)
        // Items in the deleted section fall back to unsectioned
        collection = collection.map { item in
            guard item.sectionId == id else { return item }
            var copy = item
            copy.sectionId = nil
            return copy
        }
        Store.save(collection, key: Key.collection)
    }

    // Full restore from the server copy (after sign-in on a fresh install)
    func hydrateFromServer(_ dto: API.LibrarySnapshotDTO) {
        let collectionItems = (dto.collection ?? []).map { serverItemToSaved($0) }
        let wishlistItems = (dto.wishlist ?? []).map { serverItemToSaved($0) }
        collection = collectionItems
        wishlist = wishlistItems
        showcaseSlugs = dto.showcaseSlugs ?? []
        sections = dto.sections ?? []
        complimentLog = dto.complimentLog ?? []
        currentlyWearing = dto.currentlyWearingSlug

        Store.save(collectionItems, key: Key.collection)
        Store.save(wishlistItems, key: Key.wishlist)
        Store.save(showcaseSlugs, key: Key.showcase)
        Store.save(sections, key: Key.sections)
        Store.save(complimentLog, key: Key.complimentLog)
        if let wearing = dto.currentlyWearingSlug {
            Store.saveString(wearing, key: Key.wearing)
        } else {
            Store.remove(key: Key.wearing)
        }
    }

    // Converts a server library row into a SavedFragrance, mapping lastWornOn → lastWornAt.
    private func serverItemToSaved(_ item: API.ServerSavedFragrance) -> SavedFragrance {
        var lastWornAt = item.lastWornAt
        if lastWornAt == nil, let lastWornOn = item.lastWornOn {
            let formatter = DateFormatter()
            formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"
            if let parsed = formatter.date(from: "\(lastWornOn)T12:00:00") {
                lastWornAt = parsed.timeIntervalSince1970 * 1000
            }
        }
        return SavedFragrance(
            slug: item.slug,
            name: item.name,
            brand: item.brand,
            addedAt: item.addedAt ?? nowMillis(),
            imageUrl: item.imageUrl,
            rating: item.rating,
            review: item.review,
            seasons: item.seasons,
            occasions: item.occasions,
            notes: item.notes,
            noteImages: item.noteImages,
            overview: item.overview,
            lowestPrice: item.lowestPrice,
            wearCount: item.wearCount,
            lastWornAt: lastWornAt,
            sectionId: item.sectionId
        )
    }

    func toggleShowcase(_ slug: String) {
        if showcaseSlugs.contains(slug) {
            showcaseSlugs.removeAll { $0 == slug }
        } else if showcaseSlugs.count < 10 {
            showcaseSlugs.append(slug)
        }
        Store.save(showcaseSlugs, key: Key.showcase)
    }

    func setCurrentlyWearing(_ slug: String?) {
        currentlyWearing = slug
        if let slug {
            Store.saveString(slug, key: Key.wearing)
        } else {
            Store.remove(key: Key.wearing)
        }
    }

    // Collection

    func addToCollection(_ item: SavedFragrance) {
        guard !collection.contains(where: { $0.slug == item.slug }) else { return }
        var newItem = item
        newItem.addedAt = nowMillis()
        collection.insert(newItem, at: 0)
        Store.save(collection, key: Key.collection)
    }

    func removeFromCollection(_ slug: String) {
        collection.removeAll { $0.slug == slug }
        Store.save(collection, key: Key.collection)
        // Keep showcase and currently-wearing consistent with the collection
        if showcaseSlugs.contains(slug) {
            showcaseSlugs.removeAll { $0 == slug }
            Store.save(showcaseSlugs, key: Key.showcase)
        }
        if currentlyWearing == slug {
            currentlyWearing = nil
            Store.remove(key: Key.wearing)
        }
    }

    func updateCollectionItem(_ slug: String, _ patch: (inout SavedFragrance) -> Void) {
        collection = collection.map { item in
            guard item.slug == slug else { return item }
            var copy = item
            patch(&copy)
            return copy
        }
        Store.save(collection, key: Key.collection)
    }

    func logWear(_ slug: String) {
        collection = collection.map { item in
            guard item.slug == slug else { return item }
            var copy = item
            copy.wearCount = (copy.wearCount ?? 0) + 1
            copy.lastWornAt = nowMillis()
            return copy
        }
        Store.save(collection, key: Key.collection)
        // Logging a wear also makes it today's scent and records the date for graphs
        setCurrentlyWearing(slug)
        let today = todayString()
        if !wearLog.contains(where: { $0.slug == slug && $0.date == today }) {
            wearLog.append(WearEvent(slug: slug, date: today))
            Store.save(wearLog, key: Key.wearLog)
        }
    }

    // Wishlist

    func addToWishlist(_ item: SavedFragrance) {
        guard !wishlist.contains(where: { $0.slug == item.slug }) else { return }
        var newItem = item
        newItem.addedAt = nowMillis()
        wishlist.insert(newItem, at: 0)
        Store.save(wishlist, key: Key.wishlist)
    }

    func removeFromWishlist(_ slug: String) {
        wishlist.removeAll { $0.slug == slug }
        Store.save(wishlist, key: Key.wishlist)
    }

    func updateWishlistItem(_ slug: String, _ patch: (inout SavedFragrance) -> Void) {
        wishlist = wishlist.map { item in
            guard item.slug == slug else { return item }
            var copy = item
            patch(&copy)
            return copy
        }
        Store.save(wishlist, key: Key.wishlist)
    }

    // "Got it" — a wishlist fragrance was purchased; carry its data into the collection.
    func moveToCollection(_ slug: String) {
        if let entry = wishlist.first(where: { $0.slug == slug }),
           !collection.contains(where: { $0.slug == slug }) {
            var moved = entry
            moved.rating = nil // wishlist rating meant "want it", not quality
            moved.addedAt = nowMillis()
            collection.insert(moved, at: 0)
            Store.save(collection, key: Key.collection)
        }
        wishlist.removeAll { $0.slug == slug }
        Store.save(wishlist, key: Key.wishlist)
    }

    func isInCollection(_ slug: String) -> Bool {
        collection.contains { $0.slug == slug }
    }

    func isInWishlist(_ slug: String) -> Bool {
        wishlist.contains { $0.slug == slug }
    }
}
