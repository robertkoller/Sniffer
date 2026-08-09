import SwiftUI

// Ported from components/NotesPyramid.tsx. Compact text layout when there are
// no note thumbnails; image chips when we have them.
struct NotesPyramid: View {
    let notes: FragranceNotes
    var noteImages: NoteImages? = nil

    private var rows: [(label: String, values: [String])] {
        [("Top", notes.top), ("Heart", notes.middle), ("Base", notes.base)]
            .filter { !$0.1.isEmpty }
    }

    private var hasImages: Bool {
        !(noteImages ?? [:]).isEmpty
    }

    var body: some View {
        if rows.isEmpty {
            EmptyView()
        } else {
            VStack(spacing: 0) {
                ForEach(Array(rows.enumerated()), id: \.offset) { index, row in
                    if hasImages {
                        chipRow(row)
                            .overlay(alignment: .top) { if index > 0 { topBorder } }
                    } else {
                        textRow(row)
                            .overlay(alignment: .top) { if index > 0 { topBorder } }
                    }
                }
            }
            .background(Palette.surface)
            .clipShape(RoundedRectangle(cornerRadius: Radius.md))
            .overlay(RoundedRectangle(cornerRadius: Radius.md).strokeBorder(Palette.border, lineWidth: 1))
        }
    }

    private var topBorder: some View {
        Palette.border.frame(height: 1)
    }

    private func label(_ text: String) -> some View {
        Text(text.uppercased())
            .font(.system(size: 9, weight: .heavy))
            .tracking(2)
            .foregroundStyle(Palette.gold)
    }

    private func textRow(_ row: (label: String, values: [String])) -> some View {
        HStack(alignment: .top, spacing: 12) {
            label(row.label)
                .frame(width: 44, alignment: .leading)
                .padding(.top, 3)
            Text(row.values.joined(separator: "  ·  "))
                .font(.system(size: 13))
                .foregroundStyle(Palette.textSecondary)
                .lineSpacing(4)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 11)
    }

    private func chipRow(_ row: (label: String, values: [String])) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            label(row.label)
            FlowLayout(spacing: 8) {
                ForEach(row.values, id: \.self) { noteName in
                    HStack(spacing: 7) {
                        NoteChipImage(url: noteImages?[noteName])
                        Text(noteName)
                            .font(.system(size: 12))
                            .foregroundStyle(Palette.textSecondary)
                            .lineLimit(1)
                            .frame(maxWidth: 130, alignment: .leading)
                    }
                    .padding(.leading, 4)
                    .padding(.trailing, 12)
                    .padding(.vertical, 4)
                    .background(Palette.surfaceRaised)
                    .clipShape(Capsule())
                    .overlay(Capsule().strokeBorder(Palette.border, lineWidth: 1))
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
    }
}
