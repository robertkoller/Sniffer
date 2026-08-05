import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  LayoutAnimation,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  suggestFragrances,
  fetchFragranceInfoCached,
  type FragranceInfo,
  type FragranceSuggestion,
} from '../services/api';
import FragranceCard from '../components/FragranceCard';
import ScreenHeader from '../components/ScreenHeader';
import FadeInView from '../components/FadeInView';
import { useAuth } from '../context/AuthContext';
import { colors, font, radius, type } from '../constants/theme';

const RECENT_KEY = 'sniffy:recentSearches';
const RECENT_LIMIT = 8;

export default function DiscoverScreen() {
  const { token } = useAuth();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<FragranceSuggestion[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const [selected, setSelected] = useState<FragranceSuggestion | null>(null);
  const [details, setDetails] = useState<FragranceInfo | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(RECENT_KEY).then(raw => {
      if (raw) {
        try {
          setRecentSearches(JSON.parse(raw));
        } catch {}
      }
    });
  }, []);

  function rememberSearch(term: string) {
    const next = [term, ...recentSearches.filter(existing => existing !== term)].slice(0, RECENT_LIMIT);
    setRecentSearches(next);
    AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next));
  }

  function clearRecentSearches() {
    setRecentSearches([]);
    AsyncStorage.removeItem(RECENT_KEY);
  }

  async function runSearch(term: string) {
    const trimmed = term.trim();
    if (!trimmed || loading) {
      return;
    }
    setQuery(trimmed);
    setLoading(true);
    setSuggestions(null);
    setSelected(null);
    setDetails(null);
    setErrorMessage(null);
    try {
      const results = await suggestFragrances(trimmed, token ?? undefined);
      if (results.length === 0) {
        setErrorMessage(`No fragrances found for “${trimmed}”.`);
      } else {
        setSuggestions(results);
        rememberSearch(trimmed);
      }
    } catch (error: any) {
      setErrorMessage(error?.message ?? 'Search failed. Is the server running?');
    } finally {
      setLoading(false);
    }
  }

  async function openSuggestion(suggestion: FragranceSuggestion) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelected(suggestion);
    setDetails(null);
    setDetailsLoading(true);
    try {
      // Info only (notes/overview/image) — no seller scraping; the suggestion's
      // URL lets the server skip its search step, and repeats come from the
      // on-device cache instantly.
      const data = await fetchFragranceInfoCached({
        name: suggestion.name,
        brand: suggestion.brand,
        url: suggestion.url,
        imageUrl: suggestion.imageUrl,
      });
      setDetails(data);
    } catch {
      // Details are optional — the card still works with suggestion data alone
    } finally {
      setDetailsLoading(false);
    }
  }

  // Detail view for one selected fragrance
  if (selected) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.detailHeader}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setSelected(null);
            }}
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={20} color={colors.text} />
            <Text style={styles.backText}>Results</Text>
          </TouchableOpacity>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
          <FadeInView triggerKey={selected.id} offsetY={16}>
            <FragranceCard
              name={details?.name ?? selected.name}
              brand={details?.brand ?? selected.brand}
              year={selected.year}
              imageUrl={details?.imageUrl ?? selected.imageUrl}
              overview={details?.overview}
              notes={details?.notes}
              noteImages={details?.noteImages}
              detailsLoading={detailsLoading}
            />
          </FadeInView>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScreenHeader title="Discover" subtitle="Find your next scent" />

      {/* Search bar */}
      <View style={styles.searchRow}>
        <View style={styles.inputWrap}>
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput
            style={styles.input}
            placeholder="Search a fragrance…"
            placeholderTextColor={colors.textFaint}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => runSearch(query)}
            returnKeyType="search"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={colors.textFaint} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.searchBtn, loading && styles.searchBtnDisabled]}
          onPress={() => runSearch(query)}
          activeOpacity={0.8}
          disabled={loading}
        >
          <Ionicons name="arrow-forward" size={18} color={colors.onGold} />
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={colors.gold} />
          <Text style={styles.loadingText}>Sniffing around…</Text>
        </View>
      )}

      {errorMessage && !loading && (
        <View style={styles.centerWrap}>
          <Ionicons name="cloud-offline-outline" size={30} color={colors.textFaint} />
          <Text style={styles.errorTitle}>Nothing found</Text>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}

      {suggestions && !loading && (
        <FlatList
          data={suggestions}
          keyExtractor={suggestion => suggestion.id}
          ListHeaderComponent={
            <Text style={styles.resultsLabel}>
              {suggestions.length} {suggestions.length === 1 ? 'RESULT' : 'RESULTS'}
            </Text>
          }
          renderItem={({ item: suggestion, index }) => (
            <FadeInView triggerKey={suggestion.id} delay={Math.min(index, 8) * 45} offsetY={10}>
              <TouchableOpacity
                style={styles.resultRow}
                onPress={() => openSuggestion(suggestion)}
                activeOpacity={0.75}
              >
                {suggestion.imageUrl || suggestion.thumbnail ? (
                  <Image
                    source={{ uri: suggestion.thumbnail ?? suggestion.imageUrl }}
                    style={styles.resultImage}
                    contentFit="contain" transition={120}
                  />
                ) : (
                  <View style={[styles.resultImage, styles.resultImageFallback]}>
                    <Ionicons name="flask-outline" size={20} color={colors.goldDim} />
                  </View>
                )}
                <View style={styles.resultInfo}>
                  <Text style={type.itemBrand}>{suggestion.brand}</Text>
                  <Text style={styles.resultName} numberOfLines={2}>
                    {suggestion.name}
                  </Text>
                  <Text style={styles.resultMeta}>
                    {[suggestion.year, suggestion.gender].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
              </TouchableOpacity>
            </FadeInView>
          )}
          ListFooterComponent={<View style={{ height: 32 }} />}
          showsVerticalScrollIndicator={false}
        />
      )}

      {!suggestions && !loading && !errorMessage && (
        <View style={styles.idleWrap}>
          <View style={styles.idleHero}>
            <Ionicons name="sparkles-outline" size={28} color={colors.gold} />
            <Text style={styles.idleTitle}>Find your next scent</Text>
            <Text style={styles.idleSubtitle}>
              Search any fragrance or brand — even abbreviations like “jpg” or “mfk”.
            </Text>
          </View>

          {recentSearches.length > 0 && (
            <View style={styles.recentBlock}>
              <View style={styles.recentHeader}>
                <Text style={styles.sectionLabelPlain}>RECENT</Text>
                <TouchableOpacity onPress={clearRecentSearches} hitSlop={8}>
                  <Text style={styles.clearText}>Clear</Text>
                </TouchableOpacity>
              </View>
              {recentSearches.map(term => (
                <TouchableOpacity
                  key={term}
                  style={styles.recentRow}
                  onPress={() => runSearch(term)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="time-outline" size={15} color={colors.textFaint} />
                  <Text style={styles.recentText}>{term}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  searchRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 8 },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 46,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
  },
  input: { flex: 1, fontSize: 15, color: colors.text },
  searchBtn: {
    width: 46,
    height: 46,
    backgroundColor: colors.gold,
    borderRadius: radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBtnDisabled: { opacity: 0.5 },

  centerWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 40 },
  loadingText: { fontSize: 13, color: colors.textMuted, letterSpacing: 0.5 },
  errorTitle: { fontFamily: font.serif, fontSize: 20, fontWeight: '700', color: colors.text },
  errorText: { fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },

  resultsLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    color: colors.textMuted,
    paddingHorizontal: 20,
    marginTop: 10,
    marginBottom: 10,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  resultImage: {
    width: 52,
    height: 68,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
  },
  resultImageFallback: {
    backgroundColor: colors.surfaceRaised,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultInfo: { flex: 1, gap: 3 },
  resultName: { fontFamily: font.serif, fontSize: 17, fontWeight: '700', color: colors.text },
  resultMeta: { fontSize: 12, color: colors.textMuted, textTransform: 'capitalize' },

  detailHeader: { paddingHorizontal: 16, paddingVertical: 10 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' },
  backText: { fontSize: 15, fontWeight: '600', color: colors.text },

  idleWrap: { flex: 1 },
  idleHero: { alignItems: 'center', paddingHorizontal: 40, paddingTop: 48, gap: 12 },
  idleTitle: { fontFamily: font.serif, fontSize: 23, fontWeight: '700', color: colors.text },
  idleSubtitle: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 22 },

  recentBlock: { marginTop: 36, paddingHorizontal: 20 },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  sectionLabelPlain: { fontSize: 10, fontWeight: '800', letterSpacing: 2, color: colors.textMuted },
  clearText: { fontSize: 12, color: colors.goldDim, fontWeight: '600' },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  recentText: { fontSize: 14, color: colors.textSecondary },
});
