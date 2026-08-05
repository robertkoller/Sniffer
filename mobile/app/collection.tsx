import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLibrary } from '../context/LibraryContext';
import type { CollectionItem, Season } from '../types';
import { SEASONS } from '../types';
import EmptyState from '../components/EmptyState';
import ScreenHeader from '../components/ScreenHeader';
import LibraryRow from '../components/LibraryRow';
import FragranceDetailSheet from '../components/FragranceDetailSheet';
import AddFragranceModal, { AddButton } from '../components/AddFragranceModal';
import SectionManager, { ManageSectionsButton } from '../components/SectionManager';
import { colors, radius } from '../constants/theme';

type SortMode = 'recent' | 'rating' | 'name' | 'worn';

const SORT_LABELS: Record<SortMode, string> = {
  recent: 'Recent',
  rating: 'Top rated',
  name: 'A–Z',
  worn: 'Most worn',
};

interface SectionGroup {
  id: string | null; // null = unsectioned
  name: string;
  items: CollectionItem[];
}

export default function CollectionScreen() {
  const { collection, sections } = useLibrary();
  const [filterText, setFilterText] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [seasonFilter, setSeasonFilter] = useState<Season | null>(null);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [addVisible, setAddVisible] = useState(false);
  const [sectionsVisible, setSectionsVisible] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const groups = useMemo<SectionGroup[]>(() => {
    let items: CollectionItem[] = collection;

    const needle = filterText.trim().toLowerCase();
    if (needle) {
      items = items.filter(
        item =>
          item.name.toLowerCase().includes(needle) || item.brand.toLowerCase().includes(needle),
      );
    }
    if (seasonFilter) {
      items = items.filter(item => (item.seasons ?? []).includes(seasonFilter));
    }

    const sorted = [...items];
    if (sortMode === 'rating') {
      sorted.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    } else if (sortMode === 'name') {
      sorted.sort((a, b) => `${a.brand} ${a.name}`.localeCompare(`${b.brand} ${b.name}`));
    } else if (sortMode === 'worn') {
      sorted.sort((a, b) => (b.wearCount ?? 0) - (a.wearCount ?? 0));
    } else {
      sorted.sort((a, b) => b.addedAt - a.addedAt);
    }

    const sectionIds = new Set(sections.map(section => section.id));
    const result: SectionGroup[] = sections.map(section => ({
      id: section.id,
      name: section.name,
      items: sorted.filter(item => item.sectionId === section.id),
    }));
    const unsectioned = sorted.filter(item => !item.sectionId || !sectionIds.has(item.sectionId));
    if (unsectioned.length > 0 || result.length === 0) {
      result.push({
        id: null,
        name: sections.length > 0 ? 'Everything else' : 'All bottles',
        items: unsectioned,
      });
    }
    return result.filter(group => group.items.length > 0);
  }, [collection, sections, filterText, sortMode, seasonFilter]);

  function toggleCollapsed(groupKey: string) {
    setCollapsedSections(current => {
      const next = new Set(current);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  }

  const selectedItem = collection.find(item => item.slug === selectedSlug) ?? null;
  const bottleWord = collection.length === 1 ? 'bottle' : 'bottles';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScreenHeader
        title="Collection"
        subtitle={`${collection.length} ${bottleWord}`}
        right={
          <View style={styles.headerButtons}>
            <ManageSectionsButton onPress={() => setSectionsVisible(true)} />
            <AddButton onPress={() => setAddVisible(true)} />
          </View>
        }
      />

      {collection.length === 0 ? (
        <EmptyState
          icon="albums-outline"
          title="No bottles yet"
          subtitle="Tap + to add a fragrance, or find one in Discover."
        />
      ) : (
        <>
          {/* Filter input */}
          <View style={styles.filterWrap}>
            <Ionicons name="search" size={14} color={colors.textMuted} />
            <TextInput
              style={styles.filterInput}
              placeholder="Filter your collection…"
              placeholderTextColor={colors.textFaint}
              value={filterText}
              onChangeText={setFilterText}
              autoCorrect={false}
            />
          </View>

          {/* Sort + season chips */}
          <View style={styles.chipRow}>
            {(Object.keys(SORT_LABELS) as SortMode[]).map(mode => (
              <TouchableOpacity
                key={mode}
                style={[styles.chip, sortMode === mode && styles.chipOn]}
                onPress={() => setSortMode(mode)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, sortMode === mode && styles.chipTextOn]}>
                  {SORT_LABELS[mode]}
                </Text>
              </TouchableOpacity>
            ))}
            {SEASONS.map(season => (
              <TouchableOpacity
                key={season}
                style={[styles.chip, seasonFilter === season && styles.chipOn]}
                onPress={() => setSeasonFilter(seasonFilter === season ? null : season)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, seasonFilter === season && styles.chipTextOn]}>
                  {season}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <FlatList
            data={groups}
            keyExtractor={group => group.id ?? '__unsectioned'}
            renderItem={({ item: group }) => {
              const groupKey = group.id ?? '__unsectioned';
              const collapsed = collapsedSections.has(groupKey);
              return (
                <View>
                  <TouchableOpacity
                    style={styles.sectionHeader}
                    onPress={() => toggleCollapsed(groupKey)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={collapsed ? 'chevron-forward' : 'chevron-down'}
                      size={14}
                      color={colors.goldDim}
                    />
                    <Text style={styles.sectionTitle}>{group.name.toUpperCase()}</Text>
                    <Text style={styles.sectionCount}>{group.items.length}</Text>
                  </TouchableOpacity>
                  {!collapsed &&
                    group.items.map(item => (
                      <LibraryRow
                        key={item.slug}
                        item={item}
                        onPress={() => setSelectedSlug(item.slug)}
                        showWears
                      />
                    ))}
                </View>
              );
            }}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <Text style={styles.noMatches}>Nothing matches those filters.</Text>
            }
          />
        </>
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
      <SectionManager visible={sectionsVisible} onClose={() => setSectionsVisible(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  headerButtons: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  filterWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 40,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: colors.surface,
  },
  filterInput: { flex: 1, fontSize: 14, color: colors.text },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.surfaceGold, borderColor: colors.goldDim },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'capitalize',
  },
  chipTextOn: { color: colors.goldBright },
  list: { paddingTop: 6, paddingBottom: 32 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 8,
  },
  sectionTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 2, color: colors.gold },
  sectionCount: { fontSize: 11, color: colors.textFaint, fontWeight: '600' },
  noMatches: { textAlign: 'center', color: colors.textMuted, fontSize: 13, marginTop: 32 },
});
