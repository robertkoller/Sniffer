import Foundation

// Ported from utils/slug.ts
func makeSlug(_ brand: String, _ name: String) -> String {
    let combined = "\(brand) \(name)".lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
    // Drop anything that isn't a-z, 0-9, whitespace, or dash
    let filtered = combined.unicodeScalars.filter { scalar in
        (scalar >= "a" && scalar <= "z")
            || (scalar >= "0" && scalar <= "9")
            || scalar == " " || scalar == "\t" || scalar == "\n"
            || scalar == "-"
    }
    var result = String(String.UnicodeScalarView(filtered))
    // Collapse whitespace runs to a single dash, then collapse dash runs
    result = result.replacingOccurrences(of: "\\s+", with: "-", options: .regularExpression)
    result = result.replacingOccurrences(of: "-+", with: "-", options: .regularExpression)
    return result
}
