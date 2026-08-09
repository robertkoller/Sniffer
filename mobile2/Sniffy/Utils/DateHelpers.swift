import Foundation

// Local calendar date as YYYY-MM-DD (matches the RN app's todayString / dateKey).
func dateKey(_ date: Date) -> String {
    let components = Calendar.current.dateComponents([.year, .month, .day], from: date)
    let year = components.year ?? 2000
    let month = components.month ?? 1
    let day = components.day ?? 1
    return String(format: "%04d-%02d-%02d", year, month, day)
}

func todayString() -> String {
    dateKey(Date())
}

// Milliseconds-since-epoch, the unit the RN app used for addedAt / lastWornAt.
func nowMillis() -> Double {
    Date().timeIntervalSince1970 * 1000
}

// Whether a millisecond timestamp falls on today's calendar date.
func isToday(millis: Double) -> Bool {
    Calendar.current.isDateInToday(Date(timeIntervalSince1970: millis / 1000))
}
