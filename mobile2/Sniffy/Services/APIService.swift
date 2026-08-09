import Foundation

// Ported from services/api.ts. Same endpoints, same JSON shapes.

enum APIError: LocalizedError {
    case server(String)
    var errorDescription: String? {
        switch self {
        case .server(let message): return message
        }
    }
}

enum API {
    // When running on a real device, point these to your server's local network IP.
    // When running in the iOS Simulator, localhost works fine.
    #if DEBUG
    static let baseURL = "http://localhost:3001"
    // The Sniffer website (price comparison) — used for "see prices" links
    static let snifferWebURL = "http://localhost:3000"
    static let isDev = true
    #else
    static let baseURL = "https://178.128.151.84.sslip.io" // VPS backend (HTTPS via Caddy + sslip.io)
    static let snifferWebURL = "https://sniffer-ybb9.vercel.app" // Vercel front end
    static let isDev = false
    #endif

    private static let decoder = JSONDecoder()

    // Reads `{ "error": "..." }` out of a non-2xx body, falling back to a default.
    private static func errorMessage(from data: Data, fallback: String) -> String {
        if let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let message = object["error"] as? String {
            return message
        }
        return fallback
    }

    private static func request(
        _ path: String,
        method: String = "GET",
        token: String? = nil,
        body: Data? = nil
    ) -> URLRequest {
        var request = URLRequest(url: URL(string: "\(baseURL)\(path)")!)
        request.httpMethod = method
        if let token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = body
        }
        return request
    }

    private static func send(_ request: URLRequest, fallback: String) async throws -> Data {
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw APIError.server(errorMessage(from: data, fallback: fallback))
        }
        return data
    }

    // Fast multi-result search: identity, year, and image only.
    static func suggestFragrances(_ query: String, token: String? = nil) async throws -> [FragranceSuggestion] {
        let encoded = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? query
        let request = request("/api/suggest?q=\(encoded)", token: token)
        let data = try await send(request, fallback: "Search failed")
        struct Wrapper: Codable { var suggestions: [FragranceSuggestion]? }
        return (try decoder.decode(Wrapper.self, from: data)).suggestions ?? []
    }

    struct InfoParams {
        var query: String?
        var name: String?
        var brand: String?
        var url: String?
        var imageUrl: String?
    }

    // Lightweight fragrance info: notes, overview, image — NO seller scraping.
    static func fetchFragranceInfo(_ params: InfoParams) async throws -> FragranceInfo {
        var components = URLComponents()
        var items: [URLQueryItem] = []
        if let query = params.query {
            items.append(URLQueryItem(name: "q", value: query))
        }
        if let url = params.url, let brand = params.brand, let name = params.name {
            items.append(URLQueryItem(name: "url", value: url))
            items.append(URLQueryItem(name: "brand", value: brand))
            items.append(URLQueryItem(name: "name", value: name))
            if let imageUrl = params.imageUrl {
                items.append(URLQueryItem(name: "image", value: imageUrl))
            }
        }
        components.queryItems = items
        let queryString = components.percentEncodedQuery ?? ""
        let request = request("/api/info?\(queryString)")
        let data = try await send(request, fallback: "Could not load fragrance info")
        return try decoder.decode(FragranceInfo.self, from: data)
    }

    // Client-side info cache: previously viewed fragrances open instantly.
    // Keyed by brand+name, 30-day TTL.
    private static let infoCachePrefix = "sniffy:infoCache:"
    private static let infoCacheTTL: TimeInterval = 30 * 24 * 60 * 60 * 1000 // milliseconds

    static func fetchFragranceInfoCached(_ params: InfoParams) async throws -> FragranceInfo {
        let cacheKey = "\(infoCachePrefix)\(params.brand ?? "")|\(params.name ?? params.query ?? "")".lowercased()
        struct CacheEntry: Codable { var savedAt: Double; var info: FragranceInfo }
        if let raw = UserDefaults.standard.data(forKey: cacheKey),
           let cached = try? decoder.decode(CacheEntry.self, from: raw) {
            let nowMs = Date().timeIntervalSince1970 * 1000
            if nowMs - cached.savedAt < infoCacheTTL {
                return cached.info
            }
        }
        let info = try await fetchFragranceInfo(params)
        let entry = CacheEntry(savedAt: Date().timeIntervalSince1970 * 1000, info: info)
        if let encoded = try? JSONEncoder().encode(entry) {
            UserDefaults.standard.set(encoded, forKey: cacheKey)
        }
        return info
    }

    static func getProfile(token: String? = nil) async throws -> UserProfile {
        let request = request("/api/profile", token: token)
        let data = try await send(request, fallback: "Could not load profile")
        struct Wrapper: Codable { var profile: UserProfile }
        return (try decoder.decode(Wrapper.self, from: data)).profile
    }

    @discardableResult
    static func saveProfile(_ profile: UserProfile, token: String? = nil) async throws -> UserProfile {
        let body = try JSONEncoder().encode(profile)
        let request = request("/api/profile", method: "PUT", token: token, body: body)
        let data = try await send(request, fallback: "Could not save profile")
        struct Wrapper: Codable { var profile: UserProfile }
        return (try decoder.decode(Wrapper.self, from: data)).profile
    }

    // Canonical privacy policy, served by the API server (see routes/legal.ts).
    static var privacyURL: URL? { URL(string: "\(baseURL)/privacy") }

    static func snifferPageUrl(_ brand: String, _ name: String) -> URL? {
        let query = "\(brand) \(name)".addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        return URL(string: "\(snifferWebURL)/?q=\(query)")
    }

    static func googleSignInUrl(returnUrl: String) -> URL? {
        let encoded = returnUrl.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? returnUrl
        return URL(string: "\(baseURL)/api/auth/google/start?return=\(encoded)")
    }

    struct DevSession: Codable { var token: String; var user: AuthUser }

    static func devSignIn(email: String, name: String) async throws -> DevSession {
        let body = try JSONSerialization.data(withJSONObject: ["email": email, "name": name])
        let request = request("/api/auth/dev", method: "POST", body: body)
        let data = try await send(request, fallback: "Sign-in failed")
        return try decoder.decode(DevSession.self, from: data)
    }

    static func fetchMe(token: String) async throws -> AuthUser {
        let request = request("/api/auth/me", token: token)
        let data = try await send(request, fallback: "Session expired")
        struct Wrapper: Codable { var user: AuthUser }
        return (try decoder.decode(Wrapper.self, from: data)).user
    }

    static func signOutServer(token: String) async {
        let request = request("/api/auth/logout", method: "POST", token: token)
        _ = try? await URLSession.shared.data(for: request)
    }

    struct LibraryPushPayload: Encodable {
        var collection: [SavedFragrance]
        var wishlist: [SavedFragrance]
        var currentlyWearingSlug: String?
        var showcaseSlugs: [String]
        var sections: [CollectionSection]
        var complimentLog: [ComplimentEvent]
    }

    static func pushLibrarySnapshot(token: String, payload: LibraryPushPayload) async {
        guard let body = try? JSONEncoder().encode(payload) else { return }
        let request = request("/api/social/library", method: "PUT", token: token, body: body)
        _ = try? await URLSession.shared.data(for: request)
    }

    // Pull the server copy of the library (used to restore after sign-in).
    // Collection items carry server-verified wearCount and lastWornOn.
    struct ServerSavedFragrance: Codable {
        var slug: String
        var name: String
        var brand: String
        var addedAt: Double?
        var imageUrl: String?
        var rating: Double?
        var review: String?
        var seasons: [String]?
        var occasions: [String]?
        var notes: FragranceNotes?
        var noteImages: NoteImages?
        var overview: String?
        var lowestPrice: String?
        var wearCount: Int?
        var lastWornAt: Double?
        var lastWornOn: String?
        var sectionId: String?
    }

    struct LibrarySnapshotDTO: Codable {
        var collection: [ServerSavedFragrance]?
        var wishlist: [ServerSavedFragrance]?
        var currentlyWearingSlug: String?
        var showcaseSlugs: [String]?
        var sections: [CollectionSection]?
        var complimentLog: [ComplimentEvent]?
    }

    static func fetchLibrarySnapshot(token: String) async throws -> LibrarySnapshotDTO {
        let request = request("/api/social/library", token: token)
        let data = try await send(request, fallback: "Could not load library")
        struct Wrapper: Codable { var library: LibrarySnapshotDTO }
        return (try decoder.decode(Wrapper.self, from: data)).library
    }

    struct ServerWear: Codable { var slug: String; var wornOn: String }

    static func fetchWearHistory(token: String) async throws -> [ServerWear] {
        let request = request("/api/social/wears", token: token)
        let data = try await send(request, fallback: "Could not load wear history")
        struct Wrapper: Codable { var wears: [ServerWear] }
        return (try decoder.decode(Wrapper.self, from: data)).wears
    }

    struct WearResult: Codable { var wearCount: Int; var lastWornOn: String? }

    // Server-authoritative wear logging — rejects a second wear on the same day
    static func logWearOnServer(token: String, slug: String) async throws -> WearResult {
        let body = try JSONSerialization.data(withJSONObject: ["slug": slug])
        let request = request("/api/social/wear", method: "POST", token: token, body: body)
        let data = try await send(request, fallback: "Could not log wear")
        return try decoder.decode(WearResult.self, from: data)
    }

    static func fetchMySocialProfile(token: String) async throws -> SocialProfile {
        let request = request("/api/social/me", token: token)
        let data = try await send(request, fallback: "Could not load profile")
        struct Wrapper: Codable { var profile: SocialProfile }
        return (try decoder.decode(Wrapper.self, from: data)).profile
    }
}
