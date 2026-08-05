import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLibrary } from '../context/LibraryContext';
import EmptyState from '../components/EmptyState';
import ScreenHeader from '../components/ScreenHeader';
import LibraryRow from '../components/LibraryRow';
import { RatingBadge } from '../components/RatingSlider';
import FragranceDetailSheet from '../components/FragranceDetailSheet';
import AddFragranceModal, { AddButton } from '../components/AddFragranceModal';
import { colors, font, radius, type } from '../constants/theme';

const MEDAL_COLORS = ['#EBC97B', '#C0C0C0', '#B08D57'];

export default function RankingsScreen() {
  const { collection } = useLibrary();
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [addVisible, setAddVisible] = useState(false);

  const { podium, remainder, unrated } = useMemo(() => {
    const rated = collection
      .filter(item => (item.rating ?? 0) > 0)
      .sort((a, b) => {
        const byRating = (b.rating ?? 0) - (a.rating ?? 0);
        if (byRating !== 0) {
          return byRating;
        }
        return (b.wearCount ?? 0) - (a.wearCount ?? 0);
      });
    return {
      podium: rated.slice(0, 3),
      remainder: rated.slice(3),
      unrated: collection.filter(item => !(item.rating ?? 0)),
    };
  }, [collection]);

  const selectedItem = collection.find(item => item.slug === selectedSlug) ?? null;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScreenHeader
        title="Rankings"
        subtitle="Your collection, best first"
        right={<AddButton onPress={() => setAddVisible(true)} />}
      />

      {collection.length === 0 || (podium.length === 0 && unrated.length === 0) ? (
        <EmptyState
          icon="podium-outline"
          title="No rankings yet"
          subtitle="Rate the fragrances in your collection and your leaderboard builds itself."
        />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Podium */}
          {podium.map((item, index) => (
            <TouchableOpacity
              key={item.slug}
              style={[styles.podiumCard, index === 0 && styles.podiumCardFirst]}
              onPress={() => setSelectedSlug(item.slug)}
              activeOpacity={0.8}
            >
              <View style={[styles.medal, { borderColor: MEDAL_COLORS[index] }]}>
                <Text style={[styles.medalText, { color: MEDAL_COLORS[index] }]}>{index + 1}</Text>
              </View>
              <View style={styles.podiumInfo}>
                <Text style={type.itemBrand}>{item.brand}</Text>
                <Text
                  style={[styles.podiumName, index === 0 && styles.podiumNameFirst]}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
                <RatingBadge rating={item.rating} size="large" />
              </View>
              {(item.wearCount ?? 0) > 0 && (
                <Text style={styles.podiumWears}>{item.wearCount}×</Text>
              )}
            </TouchableOpacity>
          ))}

          {/* The rest of the rated list */}
          {remainder.length > 0 && (
            <View style={styles.restBlock}>
              {remainder.map((item, index) => (
                <LibraryRow
                  key={item.slug}
                  item={item}
                  rank={index + 4}
                  onPress={() => setSelectedSlug(item.slug)}
                  showWears
                />
              ))}
            </View>
          )}

          {/* Unrated */}
          {unrated.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>NOT YET RATED</Text>
              {unrated.map(item => (
                <LibraryRow key={item.slug} item={item} onPress={() => setSelectedSlug(item.slug)} />
              ))}
            </>
          )}
        </ScrollView>
      )}

      {selectedItem && (
        <FragranceDetailSheet
          item={selectedItem}
          mode="collection"
          onClose={() => setSelectedSlug(null)}
        />
      )}

      <AddFragranceModal
        visible={addVisible}
        mode="collection"
        onClose={() => setAddVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingTop: 4, paddingBottom: 32 },

  podiumCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  podiumCardFirst: {
    backgroundColor: colors.surfaceGold,
    borderColor: colors.goldFaint,
  },
  medal: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  medalText: { fontFamily: font.serif, fontSize: 18, fontWeight: '700' },
  podiumInfo: { flex: 1, gap: 4 },
  podiumName: { fontFamily: font.serif, fontSize: 18, fontWeight: '700', color: colors.text },
  podiumNameFirst: { fontSize: 21 },
  podiumWears: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },

  restBlock: { marginTop: 4 },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    color: colors.textMuted,
    marginTop: 20,
    marginBottom: 10,
    paddingHorizontal: 20,
  },
});
