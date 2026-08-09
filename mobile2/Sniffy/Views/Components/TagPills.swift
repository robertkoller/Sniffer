import SwiftUI

// Ported from components/TagPills.tsx. Selectable pill chips (seasons,
// occasions). Read-only when `onToggle` is nil.
struct TagPills: View {
    let options: [String]
    let selected: [String]
    var onToggle: ((String) -> Void)? = nil
    var compact: Bool = false

    private var visible: [String] {
        onToggle != nil ? options : options.filter { selected.contains($0) }
    }

    var body: some View {
        if visible.isEmpty {
            EmptyView()
        } else {
            FlowLayout(spacing: 8) {
                ForEach(visible, id: \.self) { option in
                    let isSelected = selected.contains(option)
                    let pill = Text(option.capitalizedFirst)
                        .font(.system(size: compact ? 10 : 12, weight: .semibold))
                        .tracking(0.4)
                        .foregroundStyle(isSelected ? Palette.goldBright : Palette.textMuted)
                        .padding(.horizontal, compact ? 10 : 14)
                        .padding(.vertical, compact ? 4 : 7)
                        .background(isSelected ? Palette.surfaceGold : Color.clear)
                        .clipShape(Capsule())
                        .overlay(
                            Capsule().strokeBorder(isSelected ? Palette.goldDim : Palette.border, lineWidth: 1)
                        )
                    if let onToggle {
                        Button { onToggle(option) } label: { pill }
                            .buttonStyle(.plain)
                    } else {
                        pill
                    }
                }
            }
        }
    }
}

extension String {
    // Capitalize only the first letter (RN textTransform: capitalize on single words).
    var capitalizedFirst: String {
        guard let first else { return self }
        return first.uppercased() + dropFirst()
    }
}
