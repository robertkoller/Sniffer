import SwiftUI

// Ported from components/WearCharts.tsx.

private let WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"]

// Last N days, oldest first
private func lastDays(_ count: Int) -> [(key: String, date: Date)] {
    var days: [(key: String, date: Date)] = []
    let today = Date()
    for offset in stride(from: count - 1, through: 0, by: -1) {
        if let date = Calendar.current.date(byAdding: .day, value: -offset, to: today) {
            days.append((dateKey(date), date))
        }
    }
    return days
}

// Horizontal bars: how often each bottle gets worn (single-hue magnitude)
struct WearsPerBottleCard: View {
    @EnvironmentObject private var library: LibraryStore

    private var worn: [CollectionItem] {
        Array(library.collection
            .filter { ($0.wearCount ?? 0) > 0 }
            .sorted { ($0.wearCount ?? 0) > ($1.wearCount ?? 0) }
            .prefix(8))
    }

    var body: some View {
        if worn.isEmpty {
            EmptyView()
        } else {
            let maxWears = worn.map { $0.wearCount ?? 0 }.max() ?? 1
            VStack(alignment: .leading, spacing: 0) {
                CardHeaderLabel(icon: "chart.bar", text: "MOST WORN").padding(.bottom, 14)
                ForEach(worn) { item in
                    HStack(spacing: 10) {
                        Text(item.name).font(.system(size: 12)).foregroundStyle(Palette.textSecondary)
                            .lineLimit(1).frame(width: 100, alignment: .leading)
                        MagnitudeBar(fraction: Double(item.wearCount ?? 0) / Double(maxWears))
                        Text("\(item.wearCount ?? 0)").font(.system(size: 12)).foregroundStyle(Palette.textMuted)
                            .frame(width: 24, alignment: .trailing)
                    }
                    .padding(.bottom, 10)
                }
            }
            .sniffyCard()
        }
    }
}

// A single-hue horizontal magnitude bar (used across the charts).
struct MagnitudeBar: View {
    let fraction: Double // 0…1

    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                Palette.surfaceRaised
                Palette.goldDim.frame(width: max(0, geometry.size.width * min(max(fraction, 0), 1)))
            }
        }
        .frame(height: 8)
        .clipShape(RoundedRectangle(cornerRadius: 4))
    }
}

// 14-day dot matrix: which bottle was worn on which day
struct WearTimelineCard: View {
    @EnvironmentObject private var library: LibraryStore

    private var days: [(key: String, date: Date)] { lastDays(14) }

    private var recentItems: [CollectionItem] {
        let daySet = Set(days.map(\.key))
        let wornRecently = Set(library.wearLog.filter { daySet.contains($0.date) }.map(\.slug))
        return Array(library.collection
            .filter { wornRecently.contains($0.slug) }
            .sorted { ($0.wearCount ?? 0) > ($1.wearCount ?? 0) }
            .prefix(6))
    }

    var body: some View {
        if recentItems.isEmpty {
            EmptyView()
        } else {
            let wornOn = Set(library.wearLog.map { "\($0.slug)|\($0.date)" })
            VStack(alignment: .leading, spacing: 0) {
                CardHeaderLabel(icon: "calendar", text: "LAST 14 DAYS").padding(.bottom, 14)
                ScrollView(.horizontal, showsIndicators: false) {
                    VStack(spacing: 6) {
                        HStack(spacing: 0) {
                            Color.clear.frame(width: 92)
                            ForEach(days, id: \.key) { day in
                                Text(WEEKDAY_LETTERS[Calendar.current.component(.weekday, from: day.date) - 1])
                                    .font(.system(size: 8)).foregroundStyle(Palette.textFaint)
                                    .frame(width: 20)
                            }
                        }
                        ForEach(recentItems) { item in
                            HStack(spacing: 0) {
                                Text(item.name).font(.system(size: 11)).foregroundStyle(Palette.textSecondary)
                                    .lineLimit(1).frame(width: 92, alignment: .leading).padding(.trailing, 8)
                                ForEach(days, id: \.key) { day in
                                    Circle()
                                        .fill(wornOn.contains("\(item.slug)|\(day.key)") ? Palette.gold : Palette.surfaceRaised)
                                        .frame(width: 11, height: 11)
                                        .frame(width: 20)
                                }
                            }
                        }
                    }
                }
            }
            .sniffyCard()
        }
    }
}

// Tri-state compliments grid. Each day cell encodes two independent facts:
//   outline = worn that day; fill + number = compliments.
struct ComplimentsCard: View {
    @EnvironmentObject private var library: LibraryStore
    @State private var selectedSlug: String? = nil

    private var days: [(key: String, date: Date)] { lastDays(28) }

    private var totalCompliments: Int {
        library.complimentLog.reduce(0) { $0 + $1.count }
    }

    private var complimentedItems: [CollectionItem] {
        let slugsWithData = Set(library.complimentLog.map(\.slug) + library.wearLog.map(\.slug))
        return Array(library.collection.filter { slugsWithData.contains($0.slug) }.prefix(8))
    }

    private func statsForDay(_ dayKey: String) -> (worn: Bool, compliments: Int) {
        if let selectedSlug {
            let worn = library.wearLog.contains { $0.slug == selectedSlug && $0.date == dayKey }
            let compliments = library.complimentLog
                .filter { $0.slug == selectedSlug && $0.date == dayKey }
                .reduce(0) { $0 + $1.count }
            return (worn, compliments)
        }
        let worn = library.wearLog.contains { $0.date == dayKey }
        let compliments = library.complimentLog.filter { $0.date == dayKey }.reduce(0) { $0 + $1.count }
        return (worn, compliments)
    }

    private var weeks: [[(key: String, date: Date)]] {
        var result: [[(key: String, date: Date)]] = []
        var index = 0
        while index < days.count {
            result.append(Array(days[index..<min(index + 7, days.count)]))
            index += 7
        }
        return result
    }

    var body: some View {
        if library.collection.isEmpty || (library.wearLog.isEmpty && library.complimentLog.isEmpty) {
            EmptyView()
        } else {
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    CardHeaderLabel(icon: "heart", text: "COMPLIMENTS")
                    Spacer()
                    Text("\(totalCompliments) total").font(Fonts.serif(15)).foregroundStyle(Palette.goldBright)
                }
                .padding(.bottom, 14)

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        selectorChip(name: "All", selected: selectedSlug == nil) { selectedSlug = nil }
                        ForEach(complimentedItems) { item in
                            selectorChip(name: item.name, selected: selectedSlug == item.slug) {
                                selectedSlug = (selectedSlug == item.slug) ? nil : item.slug
                            }
                        }
                    }
                }
                .padding(.bottom, 12)

                VStack(spacing: 5) {
                    ForEach(Array(weeks.enumerated()), id: \.offset) { _, week in
                        HStack(spacing: 5) {
                            ForEach(week, id: \.key) { day in
                                let stats = statsForDay(day.key)
                                gridCell(day: day.date, worn: stats.worn, compliments: stats.compliments)
                            }
                        }
                    }
                }

                legend.padding(.top, 14)
            }
            .sniffyCard()
        }
    }

    private func selectorChip(name: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(name)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(selected ? Palette.goldBright : Palette.textMuted)
                .lineLimit(1).frame(maxWidth: 140)
                .padding(.horizontal, 12).padding(.vertical, 6)
                .background(selected ? Palette.surfaceGold : Color.clear)
                .clipShape(Capsule())
                .overlay(Capsule().strokeBorder(selected ? Palette.goldDim : Palette.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private func gridCell(day: Date, worn: Bool, compliments: Int) -> some View {
        let dayNumber = Calendar.current.component(.day, from: day)
        RoundedRectangle(cornerRadius: 6)
            .fill(compliments > 0 ? Palette.gold : (worn ? Color.clear : Palette.surfaceRaised))
            .aspectRatio(1, contentMode: .fit)
            .frame(maxWidth: .infinity)
            .overlay {
                if compliments > 0 {
                    RoundedRectangle(cornerRadius: 6).fill(Palette.gold)
                } else if worn {
                    RoundedRectangle(cornerRadius: 6).strokeBorder(Palette.goldDim, lineWidth: 1.5)
                }
            }
            .overlay {
                if compliments > 0 {
                    Text("\(compliments)").font(.system(size: 12, weight: .heavy)).foregroundStyle(Palette.onGold)
                } else {
                    Text("\(dayNumber)").font(.system(size: 9))
                        .foregroundStyle(worn ? Palette.goldDim : Palette.textFaint)
                        .fontWeight(worn ? .bold : .regular)
                }
            }
    }

    private var legend: some View {
        HStack(spacing: 6) {
            legendCell(fill: Palette.surfaceRaised, border: nil, number: nil)
            Text("not worn").legendText()
            legendCell(fill: Color.clear, border: Palette.goldDim, number: nil)
            Text("worn, none").legendText()
            legendCell(fill: Palette.gold, border: nil, number: "2")
            Text("complimented").legendText()
        }
    }

    private func legendCell(fill: Color, border: Color?, number: String?) -> some View {
        RoundedRectangle(cornerRadius: 4).fill(fill)
            .frame(width: 18, height: 18)
            .overlay {
                if let border {
                    RoundedRectangle(cornerRadius: 4).strokeBorder(border, lineWidth: 1.5)
                }
                if let number {
                    Text(number).font(.system(size: 12, weight: .heavy)).foregroundStyle(Palette.onGold)
                }
            }
    }
}

private extension Text {
    func legendText() -> some View {
        self.font(.system(size: 10)).foregroundStyle(Palette.textMuted).padding(.trailing, 8)
    }
}
