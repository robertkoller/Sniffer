import Foundation

// Ported from types.ts. Field names and optionality mirror the TypeScript
// interfaces so the same server JSON and persisted blobs round-trip cleanly.

struct OnlineSeller: Codable, Hashable {
    var name: String
    var price: String
    var url: String
    var credibilityScore: Double
    var isTrusted: Bool
}

struct FragranceNotes: Codable, Hashable {
    var top: [String]
    var middle: [String]
    var base: [String]

    init(top: [String] = [], middle: [String] = [], base: [String] = []) {
        self.top = top
        self.middle = middle
        self.base = base
    }
}

// Map of note name → thumbnail image URL (from Fragrantica's CDN)
typealias NoteImages = [String: String]

struct FragranceResult: Codable, Hashable {
    var name: String
    var brand: String
    var overview: String
    var imageUrl: String?
    var notes: FragranceNotes
    var noteImages: NoteImages?
    var onlineSellers: [OnlineSeller]
}

// Lightweight info from /api/info — everything Sniffy needs, no sellers
struct FragranceInfo: Codable, Hashable {
    var name: String
    var brand: String
    var overview: String
    var imageUrl: String?
    var notes: FragranceNotes
    var noteImages: NoteImages?
}

// User taste profile, stored on the server (shared with Sniffer)
let SCENT_FAMILIES: [String] = [
    "fresh", "citrus", "aquatic", "warm & spicy", "woody",
    "sweet & gourmand", "floral", "powdery", "leather", "green",
]

enum GenderPreference: String, Codable, CaseIterable {
    case men
    case women
    case all
}

struct UserProfile: Codable, Equatable {
    var genderPreference: GenderPreference
    var scentFamilies: [String]

    init(genderPreference: GenderPreference = .all, scentFamilies: [String] = []) {
        self.genderPreference = genderPreference
        self.scentFamilies = scentFamilies
    }
}

// One row from /api/suggest — a fragrance identity straight from the search index
struct FragranceSuggestion: Codable, Hashable, Identifiable {
    var id: String
    var name: String
    var brand: String
    var year: Int?
    var gender: String?
    var thumbnail: String?
    var imageUrl: String?
    var url: String
}

let SEASONS: [String] = ["spring", "summer", "fall", "winter"]
let OCCASIONS: [String] = ["daily", "office", "night out", "date", "formal", "sport"]

// A user-defined shelf inside the collection ("Woody", "Summer rotation", …)
struct CollectionSection: Codable, Hashable, Identifiable {
    var id: String
    var name: String
}

// One day a fragrance was worn (dates are YYYY-MM-DD)
struct WearEvent: Codable, Hashable {
    var slug: String
    var date: String
}

// Compliments received for a fragrance on a given day
struct ComplimentEvent: Codable, Hashable {
    var slug: String
    var date: String
    var count: Int
}

// A fragrance saved by the user (collection or wishlist).
// Older persisted items only carry slug/name/brand/rating/addedAt —
// every newer field must stay optional for backward compatibility.
struct SavedFragrance: Codable, Hashable, Identifiable {
    var slug: String
    var name: String
    var brand: String
    var addedAt: Double
    var imageUrl: String?
    var rating: Double?          // 1–10; in the wishlist this reads as "want it" priority
    var review: String?
    var seasons: [String]?
    var occasions: [String]?
    var notes: FragranceNotes?   // snapshot taken when saved from search
    var noteImages: NoteImages?  // note-name → thumbnail, snapshot from search
    var overview: String?
    var lowestPrice: String?     // cached at time of save
    var wearCount: Int?
    var lastWornAt: Double?
    var sectionId: String?       // collection section this bottle lives in

    var id: String { slug }

    init(
        slug: String,
        name: String,
        brand: String,
        addedAt: Double = Date().timeIntervalSince1970 * 1000,
        imageUrl: String? = nil,
        rating: Double? = nil,
        review: String? = nil,
        seasons: [String]? = nil,
        occasions: [String]? = nil,
        notes: FragranceNotes? = nil,
        noteImages: NoteImages? = nil,
        overview: String? = nil,
        lowestPrice: String? = nil,
        wearCount: Int? = nil,
        lastWornAt: Double? = nil,
        sectionId: String? = nil
    ) {
        self.slug = slug
        self.name = name
        self.brand = brand
        self.addedAt = addedAt
        self.imageUrl = imageUrl
        self.rating = rating
        self.review = review
        self.seasons = seasons
        self.occasions = occasions
        self.notes = notes
        self.noteImages = noteImages
        self.overview = overview
        self.lowestPrice = lowestPrice
        self.wearCount = wearCount
        self.lastWornAt = lastWornAt
        self.sectionId = sectionId
    }
}

typealias CollectionItem = SavedFragrance
typealias WishlistItem = SavedFragrance

// Auth & social (ported from services/api.ts)

struct AuthUser: Codable, Hashable {
    var id: Int
    var email: String
    var name: String
    var picture: String?
}

struct SocialProfileItem: Codable, Hashable {
    var slug: String
    var name: String
    var brand: String
    var imageUrl: String?
    var rating: Double?
    var wearCount: Int?
}

struct SocialProfileStats: Codable, Hashable {
    var bottles: Int
    var wishlistCount: Int
    var totalWears: Int
    var averageRating: Double
}

struct SocialProfileUser: Codable, Hashable {
    var id: Int
    var name: String
    var picture: String?
}

struct SocialProfile: Codable, Hashable {
    var user: SocialProfileUser
    var showcase: [SocialProfileItem]
    var showcaseIsCurated: Bool
    var currentlyWearing: SocialProfileItem?
    var stats: SocialProfileStats
}
