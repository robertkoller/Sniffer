import Foundation

// Ported from utils/taste.ts.
// Note keywords that signal each scent family. Matching is substring-based
// against lowercased note names, so "Calabrian bergamot" hits "bergamot".
private let FAMILY_NOTE_KEYWORDS: [String: [String]] = [
    "fresh":            ["bergamot", "mint", "lavender", "grapefruit", "green apple", "aldehyde", "neroli"],
    "citrus":           ["lemon", "bergamot", "orange", "grapefruit", "mandarin", "lime", "citrus", "yuzu", "petitgrain"],
    "aquatic":          ["sea", "marine", "aquatic", "water", "salt", "ozon", "calone"],
    "warm & spicy":     ["pepper", "cinnamon", "cardamom", "ginger", "saffron", "nutmeg", "clove", "amber", "incense", "labdanum"],
    "woody":            ["cedar", "sandalwood", "vetiver", "oud", "agarwood", "oakmoss", "patchouli", "wood", "birch", "cypress"],
    "sweet & gourmand": ["vanilla", "tonka", "caramel", "chocolate", "coffee", "praline", "honey", "benzoin", "sugar", "almond", "cacao"],
    "floral":           ["rose", "jasmine", "iris", "violet", "orange blossom", "tuberose", "lily", "peony", "geranium", "ylang"],
    "powdery":          ["iris", "musk", "heliotrope", "powder", "orris", "tonka"],
    "leather":          ["leather", "suede", "tobacco", "birch tar", "styrax"],
    "green":            ["grass", "green", "galbanum", "tea", "fig", "basil", "violet leaf", "bamboo"],
]

// Which of the user's preferred scent families does this fragrance hit?
func matchTasteFamilies(_ notes: FragranceNotes?, _ preferredFamilies: [String]) -> [String] {
    guard let notes, !preferredFamilies.isEmpty else {
        return []
    }
    let allNotes = (notes.top + notes.middle + notes.base).map { $0.lowercased() }
    if allNotes.isEmpty {
        return []
    }
    return preferredFamilies.filter { family in
        guard let keywords = FAMILY_NOTE_KEYWORDS[family] else { return false }
        return keywords.contains { keyword in
            allNotes.contains { $0.contains(keyword) }
        }
    }
}

// Best single scent-family match for a fragrance, preferring the user's chosen
// families first. Used by the collection's "auto-sort by scent type".
func bestFamilyFor(_ notes: FragranceNotes?, _ preferredFamilies: [String], _ allFamilies: [String]) -> String? {
    guard notes != nil else {
        return nil
    }
    let ordered = preferredFamilies + allFamilies.filter { !preferredFamilies.contains($0) }
    return matchTasteFamilies(notes, ordered).first
}
