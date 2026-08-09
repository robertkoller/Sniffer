import Foundation

// Thin JSON-in-UserDefaults layer, standing in for the RN app's AsyncStorage.
enum Store {
    private static let defaults = UserDefaults.standard

    static func save<T: Encodable>(_ value: T, key: String) {
        if let data = try? JSONEncoder().encode(value) {
            defaults.set(data, forKey: key)
        }
    }

    static func load<T: Decodable>(_ type: T.Type, key: String) -> T? {
        guard let data = defaults.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(type, from: data)
    }

    static func saveString(_ value: String, key: String) {
        defaults.set(value, forKey: key)
    }

    static func loadString(key: String) -> String? {
        defaults.string(forKey: key)
    }

    static func remove(key: String) {
        defaults.removeObject(forKey: key)
    }
}
