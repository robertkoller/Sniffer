import SwiftUI

// Fragrance thumbnail with a white backing (bottles are shot on white) and a
// flask fallback when there's no URL — the RN app's expo-image contentFit="contain".
struct RemoteImage: View {
    let url: String?
    var width: CGFloat
    var height: CGFloat
    var cornerRadius: CGFloat = Radius.sm
    var fallbackIconSize: CGFloat = 20

    var body: some View {
        Group {
            if let url, let parsed = URL(string: url) {
                AsyncImage(url: parsed, transaction: Transaction(animation: .easeOut(duration: 0.12))) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().scaledToFit()
                            .frame(width: width, height: height)
                            .background(Palette.white)
                    case .failure:
                        fallback
                    case .empty:
                        ZStack {
                            Palette.white
                            ProgressView().tint(Palette.goldDim)
                        }
                        .frame(width: width, height: height)
                    @unknown default:
                        fallback
                    }
                }
            } else {
                fallback
            }
        }
        .frame(width: width, height: height)
        .clipShape(RoundedRectangle(cornerRadius: cornerRadius))
    }

    private var fallback: some View {
        ZStack {
            Palette.surfaceRaised
            Image(systemName: "flask")
                .font(.system(size: fallbackIconSize))
                .foregroundStyle(Palette.goldDim)
        }
        .frame(width: width, height: height)
    }
}

// Rounded chip image used inside the notes pyramid (contentFit="cover").
struct NoteChipImage: View {
    let url: String?
    var size: CGFloat = 26

    var body: some View {
        Group {
            if let url, let parsed = URL(string: url) {
                AsyncImage(url: parsed) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    Palette.white
                }
            } else {
                ZStack {
                    Palette.surface
                    Image(systemName: "leaf")
                        .font(.system(size: 13))
                        .foregroundStyle(Palette.goldDim)
                }
            }
        }
        .frame(width: size, height: size)
        .background(Palette.white)
        .clipShape(Circle())
    }
}
