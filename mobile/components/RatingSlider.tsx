import React, { useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent, GestureResponderEvent } from 'react-native';
import { colors, font, radius } from '../constants/theme';

interface Props {
  rating: number;                    // 0–10, one decimal; 0 = unrated
  onChange: (rating: number) => void;
  label?: string;
}

// Decimal rating out of 10 — drag or tap the track. Values snap to 0.1.
export default function RatingSlider({ rating, onChange, label }: Props) {
  const [trackWidth, setTrackWidth] = useState(0);
  const [draftRating, setDraftRating] = useState<number | null>(null);

  const shownRating = draftRating ?? rating;

  function valueFromTouch(event: GestureResponderEvent): number {
    if (trackWidth <= 0) {
      return shownRating;
    }
    const x = event.nativeEvent.locationX;
    const raw = (x / trackWidth) * 10;
    return Math.round(Math.min(Math.max(raw, 0), 10) * 10) / 10;
  }

  return (
    <View>
      <View style={styles.headerRow}>
        {label ? <Text style={styles.label}>{label}</Text> : <View />}
        <Text style={styles.value}>
          {shownRating > 0 ? shownRating.toFixed(1) : '—'}
          <Text style={styles.valueOutOf}> / 10</Text>
        </Text>
      </View>
      <View
        style={styles.track}
        onLayout={(event: LayoutChangeEvent) => setTrackWidth(event.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={event => setDraftRating(valueFromTouch(event))}
        onResponderMove={event => setDraftRating(valueFromTouch(event))}
        onResponderRelease={event => {
          const value = valueFromTouch(event);
          setDraftRating(null);
          onChange(value);
        }}
      >
        <View style={[styles.fill, { width: `${(shownRating / 10) * 100}%` }]} />
        {[2, 4, 6, 8].map(tick => (
          <View key={tick} style={[styles.tick, { left: `${tick * 10}%` }]} />
        ))}
      </View>
      <View style={styles.scaleRow}>
        <Text style={styles.scaleText}>0</Text>
        <Text style={styles.scaleText}>5</Text>
        <Text style={styles.scaleText}>10</Text>
      </View>
    </View>
  );
}

// Small read-only badge used in list rows
export function RatingBadge({ rating, size = 'small' }: { rating?: number; size?: 'small' | 'large' }) {
  if (!rating || rating <= 0) {
    return null;
  }
  const large = size === 'large';
  return (
    <View style={[badgeStyles.badge, large && badgeStyles.badgeLarge]}>
      <Text style={[badgeStyles.text, large && badgeStyles.textLarge]}>{rating.toFixed(1)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 2, color: colors.textMuted },
  value: { fontFamily: font.serif, fontSize: 26, fontWeight: '700', color: colors.goldBright },
  valueOutOf: { fontSize: 13, color: colors.textMuted, fontFamily: 'System', fontWeight: '600' },
  track: {
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.goldDim,
  },
  tick: {
    position: 'absolute',
    top: 8,
    bottom: 8,
    width: 1,
    backgroundColor: colors.borderLight,
  },
  scaleRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, paddingHorizontal: 2 },
  scaleText: { fontSize: 10, color: colors.textFaint },
});

const badgeStyles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceGold,
    borderWidth: 1,
    borderColor: colors.goldFaint,
    borderRadius: radius.sm,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeLarge: { paddingHorizontal: 10, paddingVertical: 4 },
  text: { fontFamily: font.serif, fontSize: 13, fontWeight: '700', color: colors.goldBright },
  textLarge: { fontSize: 17 },
});
