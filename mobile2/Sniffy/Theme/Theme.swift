import SwiftUI

// Sniffy design system — dark, warm, editorial. Gold on near-black.
// Ported from constants/theme.ts.

extension Color {
    init(hex: String) {
        let cleaned = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        var value: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&value)
        let red = Double((value & 0xFF0000) >> 16) / 255.0
        let green = Double((value & 0x00FF00) >> 8) / 255.0
        let blue = Double(value & 0x0000FF) / 255.0
        self.init(.sRGB, red: red, green: green, blue: blue, opacity: 1.0)
    }
}

enum Palette {
    // Surfaces
    static let bg = Color(hex: "#100E0B")
    static let surface = Color(hex: "#1A1712")
    static let surfaceRaised = Color(hex: "#221E17")
    static let surfaceGold = Color(hex: "#2A2416")

    // Lines
    static let border = Color(hex: "#2B2620")
    static let borderLight = Color(hex: "#3A342B")

    // Gold accent scale
    static let gold = Color(hex: "#D4A94E")
    static let goldBright = Color(hex: "#EBC97B")
    static let goldDim = Color(hex: "#8A7340")
    static let goldFaint = Color(hex: "#4A3F26")

    // Text
    static let text = Color(hex: "#F2EAD9")
    static let textSecondary = Color(hex: "#BDAF94")
    static let textMuted = Color(hex: "#847A66")
    static let textFaint = Color(hex: "#5C5546")

    // Semantic
    static let trusted = Color(hex: "#8FBC7F")
    static let trustedDim = Color(hex: "#2A3324")
    static let danger = Color(hex: "#D08770")
    static let dangerDim = Color(hex: "#3A2721")

    // On-gold
    static let onGold = Color(hex: "#1A1509")

    static let white = Color.white
    static let black = Color.black

    // Podium medals (from rankings.tsx)
    static let medalGold = Color(hex: "#EBC97B")
    static let medalSilver = Color(hex: "#C0C0C0")
    static let medalBronze = Color(hex: "#B08D57")
}

enum Radius {
    static let sm: CGFloat = 8
    static let md: CGFloat = 14
    static let lg: CGFloat = 20
    static let xl: CGFloat = 28
    static let pill: CGFloat = 999
}

enum Spacing {
    static let xs: CGFloat = 4
    static let sm: CGFloat = 8
    static let md: CGFloat = 12
    static let lg: CGFloat = 16
    static let xl: CGFloat = 20
    static let xxl: CGFloat = 28
}

// Georgia is bundled on iOS; use it for the editorial serif headings.
enum Fonts {
    static func serif(_ size: CGFloat, weight: Font.Weight = .bold) -> Font {
        Font.custom("Georgia", size: size).weight(weight)
    }
    static func sans(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        Font.system(size: size, weight: weight)
    }
}

// Shared text style helpers (mirrors the `type` object in theme.ts).
extension View {
    func eyebrowStyle() -> some View {
        self.font(.system(size: 10, weight: .heavy))
            .tracking(2.5)
            .foregroundStyle(Palette.gold)
            .textCase(.uppercase)
    }

    func itemBrandStyle() -> some View {
        self.font(.system(size: 10, weight: .heavy))
            .tracking(2)
            .foregroundStyle(Palette.textMuted)
            .textCase(.uppercase)
    }
}
