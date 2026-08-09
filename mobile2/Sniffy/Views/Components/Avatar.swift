import SwiftUI

// Ported from the Avatar in components/SocialCards.tsx.
struct Avatar: View {
    let name: String
    var picture: String? = nil
    var size: CGFloat = 52

    private var initials: String {
        name.split(whereSeparator: { $0 == " " || $0 == "\t" || $0 == "\n" })
            .prefix(2)
            .compactMap { $0.first.map { String($0).uppercased() } }
            .joined()
    }

    var body: some View {
        if let picture, let url = URL(string: picture) {
            AsyncImage(url: url) { image in
                image.resizable().scaledToFill()
            } placeholder: {
                Palette.surfaceGold
            }
            .frame(width: size, height: size)
            .clipShape(Circle())
        } else {
            ZStack {
                Circle().fill(Palette.surfaceGold)
                Circle().strokeBorder(Palette.goldDim, lineWidth: 1)
                Text(initials)
                    .font(Fonts.serif(size * 0.36))
                    .foregroundStyle(Palette.goldBright)
            }
            .frame(width: size, height: size)
        }
    }
}
