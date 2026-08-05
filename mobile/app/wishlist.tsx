import React, { useState, useMemo } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLibrary } from '../context/LibraryContext';
import EmptyState from '../components/EmptyState';
import ScreenHeader from '../components/ScreenHeader';
import LibraryRow from '../components/LibraryRow';
import FragranceDetailSheet from '../components/FragranceDetailSheet';
import AddFragranceModal, { AddButton } from '../components/AddFragranceModal';
import { colors } from '../constants/theme';

export default function WishlistScreen() {
  const { wishlist } = useLibrary();
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [addVisible, setAddVisible] = useState(false);

  // Highest "want it" priority first, then most recently added.
  const sortedItems = useMemo(
    () =>
      [...wishlist].sort((a, b) => {
        const byPriority = (b.rating ?? 0) - (a.rating ?? 0);
        if (byPriority !== 0) {
          return byPriority;
        }
        return b.addedAt - a.addedAt;
      }),
    [wishlist],
  );

  const selectedItem = wishlist.find(item => item.slug === selectedSlug) ?? null;
  const scentWord = wishlist.length === 1 ? 'scent' : 'scents';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScreenHeader
        title="Wishlist"
        subtitle={`${wishlist.length} ${scentWord} you're hunting`}
        right={<AddButton onPress={() => setAddVisible(true)} />}
      />

      {wishlist.length === 0 ? (
        <EmptyState
          icon="bookmark-outline"
          title="Nothing saved yet"
          subtitle="Tap + to save a fragrance and rank how badly you want it."
        />
      ) : (
        <FlatList
          data={sortedItems}
          keyExtractor={item => item.slug}
          renderItem={({ item }) => (
            <LibraryRow item={item} onPress={() => setSelectedSlug(item.slug)} showPrice />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      {selectedItem && (
        <FragranceDetailSheet
          item={selectedItem}
          mode="wishlist"
          onClose={() => setSelectedSlug(null)}
        />
      )}

      <AddFragranceModal
        visible={addVisible}
        mode="wishlist"
        onClose={() => setAddVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  list: { paddingTop: 6, paddingBottom: 32 },
});
