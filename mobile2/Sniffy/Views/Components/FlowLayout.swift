import SwiftUI

// Wrapping horizontal layout — the equivalent of RN's flexWrap row used for
// every chip/pill group. Wraps to a new line when the row runs out of width.
struct FlowLayout: Layout {
    var spacing: CGFloat = 8
    var lineSpacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout Void) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var rows: [[CGSize]] = [[]]
        var currentRowWidth: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            let addWidth = rows[rows.count - 1].isEmpty ? size.width : size.width + spacing
            if currentRowWidth + addWidth > maxWidth && !rows[rows.count - 1].isEmpty {
                rows.append([size])
                currentRowWidth = size.width
            } else {
                rows[rows.count - 1].append(size)
                currentRowWidth += addWidth
            }
        }

        let totalHeight = rows.reduce(CGFloat(0)) { partial, row in
            let rowHeight = row.map(\.height).max() ?? 0
            return partial + rowHeight
        } + CGFloat(max(0, rows.count - 1)) * lineSpacing

        return CGSize(width: maxWidth == .infinity ? currentRowWidth : maxWidth, height: totalHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout Void) {
        let maxWidth = bounds.width
        var x = bounds.minX
        var y = bounds.minY
        var rowHeight: CGFloat = 0
        var isFirstInRow = true

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            let addWidth = isFirstInRow ? size.width : size.width + spacing
            if x - bounds.minX + addWidth > maxWidth && !isFirstInRow {
                x = bounds.minX
                y += rowHeight + lineSpacing
                rowHeight = 0
                isFirstInRow = true
            }
            let placeX = isFirstInRow ? x : x + spacing
            subview.place(
                at: CGPoint(x: placeX, y: y),
                anchor: .topLeading,
                proposal: ProposedViewSize(size)
            )
            x = placeX + size.width
            rowHeight = max(rowHeight, size.height)
            isFirstInRow = false
        }
    }
}
