import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLibrary } from '../context/LibraryContext';
import { colors, font, radius } from '../constants/theme';

function dateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

// Last N days, oldest first
function lastDays(count: number): Array<{ key: string; date: Date }> {
  const days: Array<{ key: string; date: Date }> = [];
  for (let offset = count - 1; offset >= 0; offset--) {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    days.push({ key: dateKey(date), date });
  }
  return days;
}

const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// Horizontal bars: how often each bottle gets worn (single-hue magnitude)
export function WearsPerBottleCard() {
  const { collection } = useLibrary();

  const worn = collection
    .filter(item => (item.wearCount ?? 0) > 0)
    .sort((a, b) => (b.wearCount ?? 0) - (a.wearCount ?? 0))
    .slice(0, 8);

  if (worn.length === 0) {
    return null;
  }
  const maxWears = Math.max(...worn.map(item => item.wearCount ?? 0));

  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <Ionicons name="bar-chart-outline" size={14} color={colors.gold} />
        <Text style={styles.cardHeaderText}>MOST WORN</Text>
      </View>
      {worn.map(item => (
        <View key={item.slug} style={styles.barRow}>
          <Text style={styles.barLabel} numberOfLines={1}>{item.name}</Text>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { flex: (item.wearCount ?? 0) / maxWears }]} />
            <View style={{ flex: 1 - (item.wearCount ?? 0) / maxWears }} />
          </View>
          <Text style={styles.barCount}>{item.wearCount}</Text>
        </View>
      ))}
    </View>
  );
}

// 14-day dot matrix: which bottle was worn on which day
export function WearTimelineCard() {
  const { collection, wearLog } = useLibrary();
  const days = useMemo(() => lastDays(14), []);

  const recentSlugs = useMemo(() => {
    const daySet = new Set(days.map(day => day.key));
    const wornRecently = new Set(
      wearLog.filter(event => daySet.has(event.date)).map(event => event.slug),
    );
    return collection
      .filter(item => wornRecently.has(item.slug))
      .sort((a, b) => (b.wearCount ?? 0) - (a.wearCount ?? 0))
      .slice(0, 6);
  }, [collection, wearLog, days]);

  if (recentSlugs.length === 0) {
    return null;
  }

  const wornOn = new Set(wearLog.map(event => `${event.slug}|${event.date}`));

  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <Ionicons name="calendar-outline" size={14} color={colors.gold} />
        <Text style={styles.cardHeaderText}>LAST 14 DAYS</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          {/* Weekday header */}
          <View style={styles.matrixRow}>
            <View style={styles.matrixNameSpacer} />
            {days.map(day => (
              <Text key={day.key} style={styles.matrixDayLetter}>
                {WEEKDAY_LETTERS[day.date.getDay()]}
              </Text>
            ))}
          </View>
          {recentSlugs.map(item => (
            <View key={item.slug} style={styles.matrixRow}>
              <Text style={styles.matrixName} numberOfLines={1}>{item.name}</Text>
              {days.map(day => {
                const isWorn = wornOn.has(`${item.slug}|${day.key}`);
                return (
                  <View key={day.key} style={styles.matrixCellWrap}>
                    <View style={[styles.matrixDot, isWorn ? styles.matrixDotOn : styles.matrixDotOff]} />
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

// Tri-state compliments grid. Each day cell encodes two independent facts:
//   outline = the fragrance was worn that day; fill + number = compliments.
// So "worn, zero compliments" (hollow outline) reads differently from
// "not worn" (faint empty cell) without relying on color alone.
export function ComplimentsCard() {
  const { collection, wearLog, complimentLog } = useLibrary();
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const days = useMemo(() => lastDays(28), []);

  const totalCompliments = complimentLog.reduce((sum, entry) => sum + entry.count, 0);

  const complimentedSlugs = useMemo(() => {
    const slugsWithData = new Set([
      ...complimentLog.map(entry => entry.slug),
      ...wearLog.map(event => event.slug),
    ]);
    return collection.filter(item => slugsWithData.has(item.slug)).slice(0, 8);
  }, [collection, complimentLog, wearLog]);

  if (collection.length === 0 || (wearLog.length === 0 && complimentLog.length === 0)) {
    return null;
  }

  function statsForDay(dayKey: string): { worn: boolean; compliments: number } {
    if (selectedSlug) {
      return {
        worn: wearLog.some(event => event.slug === selectedSlug && event.date === dayKey),
        compliments: complimentLog
          .filter(entry => entry.slug === selectedSlug && entry.date === dayKey)
          .reduce((sum, entry) => sum + entry.count, 0),
      };
    }
    return {
      worn: wearLog.some(event => event.date === dayKey),
      compliments: complimentLog
        .filter(entry => entry.date === dayKey)
        .reduce((sum, entry) => sum + entry.count, 0),
    };
  }

  const weeks: Array<Array<{ key: string; date: Date }>> = [];
  for (let weekIndex = 0; weekIndex < days.length / 7; weekIndex++) {
    weeks.push(days.slice(weekIndex * 7, weekIndex * 7 + 7));
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <Ionicons name="heart-outline" size={14} color={colors.gold} />
        <Text style={styles.cardHeaderText}>COMPLIMENTS</Text>
        <View style={{ flex: 1 }} />
        <Text style={styles.totalText}>{totalCompliments} total</Text>
      </View>

      {/* Bottle selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        <TouchableOpacity
          style={[styles.chip, !selectedSlug && styles.chipOn]}
          onPress={() => setSelectedSlug(null)}
          activeOpacity={0.7}
        >
          <Text style={[styles.chipText, !selectedSlug && styles.chipTextOn]}>All</Text>
        </TouchableOpacity>
        {complimentedSlugs.map(item => (
          <TouchableOpacity
            key={item.slug}
            style={[styles.chip, selectedSlug === item.slug && styles.chipOn]}
            onPress={() => setSelectedSlug(selectedSlug === item.slug ? null : item.slug)}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, selectedSlug === item.slug && styles.chipTextOn]} numberOfLines={1}>
              {item.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* 28-day grid, one row per week, oldest first */}
      <View style={styles.grid}>
        {weeks.map((week, weekIndex) => (
          <View key={weekIndex} style={styles.gridWeekRow}>
            {week.map(day => {
              const { worn, compliments } = statsForDay(day.key);
              const cellStyle = compliments > 0
                ? styles.cellComplimented
                : worn
                  ? styles.cellWornOnly
                  : styles.cellIdle;
              return (
                <View key={day.key} style={[styles.cell, cellStyle]}>
                  {compliments > 0 ? (
                    <Text style={styles.cellCount}>{compliments}</Text>
                  ) : (
                    <Text style={[styles.cellDay, worn && styles.cellDayWorn]}>
                      {day.date.getDate()}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        ))}
      </View>

      {/* Legend — the three states, never color alone */}
      <View style={styles.legendRow}>
        <View style={[styles.legendCell, styles.cellIdle]} />
        <Text style={styles.legendText}>not worn</Text>
        <View style={[styles.legendCell, styles.cellWornOnly]} />
        <Text style={styles.legendText}>worn, none</Text>
        <View style={[styles.legendCell, styles.cellComplimented]}>
          <Text style={styles.cellCount}>2</Text>
        </View>
        <Text style={styles.legendText}>complimented</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 18,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  cardHeaderText: { fontSize: 10, fontWeight: '800', letterSpacing: 2, color: colors.gold },
  totalText: { fontFamily: font.serif, fontSize: 15, fontWeight: '700', color: colors.goldBright },

  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  barLabel: { width: 100, fontSize: 12, color: colors.textSecondary },
  barTrack: {
    flex: 1,
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
  },
  barFill: { backgroundColor: colors.goldDim, borderRadius: 4 },
  barCount: { width: 24, fontSize: 12, color: colors.textMuted, textAlign: 'right' },

  matrixRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  matrixNameSpacer: { width: 92 },
  matrixName: { width: 92, fontSize: 11, color: colors.textSecondary, paddingRight: 8 },
  matrixDayLetter: { width: 20, fontSize: 8, color: colors.textFaint, textAlign: 'center' },
  matrixCellWrap: { width: 20, alignItems: 'center' },
  matrixDot: { width: 11, height: 11, borderRadius: 5.5 },
  matrixDotOn: { backgroundColor: colors.gold },
  matrixDotOff: { backgroundColor: colors.surfaceRaised },

  chipRow: { gap: 6, paddingBottom: 12 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: 140,
  },
  chipOn: { backgroundColor: colors.surfaceGold, borderColor: colors.goldDim },
  chipText: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  chipTextOn: { color: colors.goldBright },

  grid: { gap: 5 },
  gridWeekRow: { flexDirection: 'row', gap: 5 },
  cell: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cellIdle: { backgroundColor: colors.surfaceRaised },
  cellWornOnly: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.goldDim,
  },
  cellComplimented: { backgroundColor: colors.gold },
  cellDay: { fontSize: 9, color: colors.textFaint },
  cellDayWorn: { color: colors.goldDim, fontWeight: '700' },
  cellCount: { fontSize: 12, fontWeight: '800', color: colors.onGold },

  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, flexWrap: 'wrap' },
  legendCell: {
    width: 18,
    height: 18,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  legendText: { fontSize: 10, color: colors.textMuted, marginRight: 8 },
});
