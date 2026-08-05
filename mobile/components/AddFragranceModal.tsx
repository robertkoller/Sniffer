import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { suggestFragrances, fetchFragranceInfoCached, type FragranceSuggestion } from '../services/api';
import { useLibrary } from '../context/LibraryContext';
import { useAuth } from '../context/AuthContext';
import { makeSlug } from '../utils/slug';
import { colors, font, radius, type } from '../constants/theme';

interface Props {
  visible: boolean;
  mode: 'collection' | 'wishlist';
  onClose: () => void;
}

// Reusable header "+" button that pairs with this modal
export function AddButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={addButtonStyles.button} onPress={onPress} activeOpacity={0.8} hitSlop={6}>
      <Ionicons name="add" size={22} color={colors.onGold} />
    </TouchableOpacity>
  );
}

const addButtonStyles = StyleSheet.create({
  button: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

// Search-and-add sheet: find a fragrance and drop it straight into the
// collection or wishlist without going through Discover.
export default function AddFragranceModal({ visible, mode, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<FragranceSuggestion[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { token } = useAuth();

  const {
    isInCollection,
    isInWishlist,
    addToCollection,
    addToWishlist,
    updateCollectionItem,
    updateWishlistItem,
  } = useLibrary();

  const isSaved = mode === 'collection' ? isInCollection : isInWishlist;
  const add = mode === 'collection' ? addToCollection : addToWishlist;
  const update = mode === 'collection' ? updateCollectionItem : updateWishlistItem;

  async function runSearch() {
    const trimmed = query.trim();
    if (!trimmed || loading) {
      return;
    }
    setLoading(true);
    setSuggestions(null);
    setErrorMessage(null);
    try {
      const results = await suggestFragrances(trimmed, token ?? undefined);
      if (results.length === 0) {
        setErrorMessage(`No fragrances found for “${trimmed}”.`);
      } else {
        setSuggestions(results);
      }
    } catch (error: any) {
      setErrorMessage(error?.message ?? 'Search failed. Is the server running?');
    } finally {
      setLoading(false);
    }
  }

  function handleAdd(suggestion: FragranceSuggestion) {
    const slug = makeSlug(suggestion.brand, suggestion.name);
    if (isSaved(slug)) {
      return;
    }
    add({
      slug,
      name: suggestion.name,
      brand: suggestion.brand,
      imageUrl: suggestion.imageUrl,
    });
    // Enrich with notes/overview in the background — the item is already saved
    fetchFragranceInfoCached({
      name: suggestion.name,
      brand: suggestion.brand,
      url: suggestion.url,
      imageUrl: suggestion.imageUrl,
    })
      .then(info => update(slug, { notes: info.notes, noteImages: info.noteImages, overview: info.overview, imageUrl: info.imageUrl ?? suggestion.imageUrl }))
      .catch(() => {});
  }

  function handleClose() {
    setQuery('');
    setSuggestions(null);
    setErrorMessage(null);
    setLoading(false);
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.backdropTouch} onPress={handleClose} activeOpacity={1} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheet}>
            <View style={styles.grabber} />

            <View style={styles.headerRow}>
              <Text style={styles.title}>
                Add to {mode === 'collection' ? 'Collection' : 'Wishlist'}
              </Text>
              <TouchableOpacity onPress={handleClose} style={styles.closeBtn} hitSlop={8}>
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.searchRow}>
              <View style={styles.inputWrap}>
                <Ionicons name="search" size={15} color={colors.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="Search a fragrance…"
                  placeholderTextColor={colors.textFaint}
                  value={query}
                  onChangeText={setQuery}
                  onSubmitEditing={runSearch}
                  returnKeyType="search"
                  autoCorrect={false}
                  autoFocus
                />
              </View>
              <TouchableOpacity
                style={[styles.searchBtn, loading && styles.searchBtnDisabled]}
                onPress={runSearch}
                disabled={loading}
                activeOpacity={0.8}
              >
                <Ionicons name="arrow-forward" size={17} color={colors.onGold} />
              </TouchableOpacity>
            </View>

            {loading && (
              <View style={styles.centerWrap}>
                <ActivityIndicator size="small" color={colors.gold} />
                <Text style={styles.centerText}>Sniffing around…</Text>
              </View>
            )}

            {errorMessage && !loading && (
              <View style={styles.centerWrap}>
                <Text style={styles.centerText}>{errorMessage}</Text>
              </View>
            )}

            {suggestions && !loading && (
              <FlatList
                data={suggestions}
                keyExtractor={suggestion => suggestion.id}
                style={styles.list}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item: suggestion }) => {
                  const slug = makeSlug(suggestion.brand, suggestion.name);
                  const saved = isSaved(slug);
                  return (
                    <TouchableOpacity
                      style={styles.resultRow}
                      onPress={() => handleAdd(suggestion)}
                      activeOpacity={saved ? 1 : 0.7}
                    >
                      {suggestion.thumbnail || suggestion.imageUrl ? (
                        <Image
                          source={{ uri: suggestion.thumbnail ?? suggestion.imageUrl }}
                          style={styles.resultImage}
                          contentFit="contain" transition={120}
                        />
                      ) : (
                        <View style={[styles.resultImage, styles.resultImageFallback]}>
                          <Ionicons name="flask-outline" size={16} color={colors.goldDim} />
                        </View>
                      )}
                      <View style={styles.resultInfo}>
                        <Text style={type.itemBrand}>{suggestion.brand}</Text>
                        <Text style={styles.resultName} numberOfLines={1}>
                          {suggestion.name}
                        </Text>
                        <Text style={styles.resultMeta}>
                          {[suggestion.year, suggestion.gender].filter(Boolean).join(' · ')}
                        </Text>
                      </View>
                      <View style={[styles.addIcon, saved && styles.addIconSaved]}>
                        <Ionicons
                          name={saved ? 'checkmark' : 'add'}
                          size={16}
                          color={saved ? colors.onGold : colors.goldBright}
                        />
                      </View>
                    </TouchableOpacity>
                  );
                }}
                ListFooterComponent={<View style={{ height: 16 }} />}
              />
            )}

            {!suggestions && !loading && !errorMessage && (
              <View style={styles.centerWrap}>
                <Text style={styles.centerText}>
                  Search anything — “jpg”, “mfk”, “dior sauvage”…
                </Text>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  backdropTouch: { flex: 1 },
  sheet: {
    backgroundColor: colors.surfaceRaised,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderLight,
    maxHeight: 560,
    minHeight: 340,
    paddingHorizontal: 18,
    paddingBottom: 24,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderLight,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: { fontFamily: font.serif, fontSize: 21, fontWeight: '700', color: colors.text },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 42,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
  },
  input: { flex: 1, fontSize: 14, color: colors.text },
  searchBtn: {
    width: 42,
    height: 42,
    backgroundColor: colors.gold,
    borderRadius: radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBtnDisabled: { opacity: 0.5 },
  centerWrap: { alignItems: 'center', paddingVertical: 36, gap: 10 },
  centerText: { fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
  list: { flexGrow: 0 },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 10,
    marginBottom: 8,
  },
  resultImage: {
    width: 40,
    height: 52,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
  },
  resultImageFallback: {
    backgroundColor: colors.surfaceRaised,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultInfo: { flex: 1, gap: 2 },
  resultName: { fontFamily: font.serif, fontSize: 15, fontWeight: '700', color: colors.text },
  resultMeta: { fontSize: 11, color: colors.textMuted, textTransform: 'capitalize' },
  addIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.goldDim,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addIconSaved: { backgroundColor: colors.gold, borderColor: colors.gold },
});
