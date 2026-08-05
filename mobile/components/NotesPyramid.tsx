import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import type { FragranceNotes, NoteImages } from '../types';
import { colors, radius } from '../constants/theme';

interface Props {
  notes: FragranceNotes;
  noteImages?: NoteImages;
}

// A single note rendered as an image chip. Falls back to a text-only pill
// when we have no thumbnail for that note.
function NoteChip({ name, image }: { name: string; image?: string }) {
  return (
    <View style={styles.chip}>
      {image ? (
        <Image source={{ uri: image }} style={styles.chipImage} contentFit="cover" transition={120} />
      ) : (
        <View style={[styles.chipImage, styles.chipImageFallback]}>
          <Ionicons name="leaf-outline" size={13} color={colors.goldDim} />
        </View>
      )}
      <Text style={styles.chipText} numberOfLines={1}>{name}</Text>
    </View>
  );
}

export default function NotesPyramid({ notes, noteImages }: Props) {
  const rows: Array<{ label: string; values: string[] }> = [
    { label: 'Top', values: notes.top },
    { label: 'Heart', values: notes.middle },
    { label: 'Base', values: notes.base },
  ].filter(row => row.values.length > 0);

  if (rows.length === 0) {
    return null;
  }

  const hasImages = !!noteImages && Object.keys(noteImages).length > 0;

  // Without images, keep the compact text layout; with images, show chips.
  if (!hasImages) {
    return (
      <View style={styles.block}>
        {rows.map((row, rowIndex) => (
          <View key={row.label} style={[styles.textRow, rowIndex > 0 && styles.rowBorder]}>
            <Text style={styles.label}>{row.label.toUpperCase()}</Text>
            <Text style={styles.values}>{row.values.join('  ·  ')}</Text>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.block}>
      {rows.map((row, rowIndex) => (
        <View key={row.label} style={[styles.chipRow, rowIndex > 0 && styles.rowBorder]}>
          <Text style={styles.chipRowLabel}>{row.label.toUpperCase()}</Text>
          <View style={styles.chips}>
            {row.values.map(noteName => (
              <NoteChip key={noteName} name={noteName} image={noteImages?.[noteName]} />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  textRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  label: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2,
    color: colors.gold,
    width: 44,
    paddingTop: 3,
  },
  values: { fontSize: 13, color: colors.textSecondary, flex: 1, lineHeight: 20 },

  chipRow: { paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  chipRowLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 2, color: colors.gold },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingRight: 12,
    paddingLeft: 4,
    paddingVertical: 4,
  },
  chipImage: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.white,
  },
  chipImageFallback: {
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipText: { fontSize: 12, color: colors.textSecondary, maxWidth: 130 },
});
