import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, radius } from '../constants/theme';

interface Props {
  options: readonly string[];
  selected: string[];
  onToggle?: (value: string) => void;
  compact?: boolean;
}

// Selectable pill chips (seasons, occasions). Read-only when onToggle is omitted.
export default function TagPills({ options, selected, onToggle, compact = false }: Props) {
  const visible = onToggle ? options : options.filter(option => selected.includes(option));
  if (visible.length === 0) {
    return null;
  }
  return (
    <View style={styles.row}>
      {visible.map(option => {
        const isSelected = selected.includes(option);
        const pill = (
          <View
            style={[
              styles.pill,
              compact && styles.pillCompact,
              isSelected ? styles.pillOn : styles.pillOff,
            ]}
          >
            <Text
              style={[
                styles.pillText,
                compact && styles.pillTextCompact,
                isSelected ? styles.pillTextOn : styles.pillTextOff,
              ]}
            >
              {option}
            </Text>
          </View>
        );
        if (!onToggle) {
          return <View key={option}>{pill}</View>;
        }
        return (
          <TouchableOpacity key={option} onPress={() => onToggle(option)} activeOpacity={0.7}>
            {pill}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  pillCompact: { paddingHorizontal: 10, paddingVertical: 4 },
  pillOn: { backgroundColor: colors.surfaceGold, borderColor: colors.goldDim },
  pillOff: { backgroundColor: 'transparent', borderColor: colors.border },
  pillText: { fontSize: 12, fontWeight: '600', letterSpacing: 0.4, textTransform: 'capitalize' },
  pillTextCompact: { fontSize: 10 },
  pillTextOn: { color: colors.goldBright },
  pillTextOff: { color: colors.textMuted },
});
