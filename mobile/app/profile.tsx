import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLibrary } from '../context/LibraryContext';
import { useProfile } from '../context/ProfileContext';
import { useAuth } from '../context/AuthContext';
import ScreenHeader from '../components/ScreenHeader';
import { RatingBadge } from '../components/RatingSlider';
import { AccountCard, CurrentlyWearingCard, ShowcaseShelf, Avatar } from '../components/SocialCards';
import { WearsPerBottleCard, WearTimelineCard, ComplimentsCard } from '../components/WearCharts';
import { SEASONS, SCENT_FAMILIES, type ScentFamily, type GenderPreference } from '../types';
import { colors, font, radius, type } from '../constants/theme';

interface NoteFrequency {
  note: string;
  count: number;
}

const GENDER_OPTIONS: Array<{ value: GenderPreference; label: string }> = [
  { value: 'men', label: "Men's" },
  { value: 'women', label: "Women's" },
  { value: 'all', label: 'Everything' },
];

// Taste profile editor — drives search ordering and "your taste" matches
function TasteProfileCard() {
  const { profile, updateProfile } = useProfile();

  function toggleFamily(family: ScentFamily) {
    const next = profile.scentFamilies.includes(family)
      ? profile.scentFamilies.filter(existing => existing !== family)
      : [...profile.scentFamilies, family];
    updateProfile({ scentFamilies: next });
  }

  return (
    <View style={tasteStyles.card}>
      <View style={tasteStyles.headerRow}>
        <Ionicons name="options-outline" size={14} color={colors.gold} />
        <Text style={tasteStyles.title}>TASTE PROFILE</Text>
      </View>
      <Text style={tasteStyles.caption}>
        Sniffy uses this to sort search results and flag scents you'll probably like.
      </Text>

      <Text style={tasteStyles.question}>What do you wear?</Text>
      <View style={tasteStyles.chipRow}>
        {GENDER_OPTIONS.map(option => {
          const isSelected = profile.genderPreference === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              style={[tasteStyles.chip, isSelected && tasteStyles.chipOn]}
              onPress={() => updateProfile({ genderPreference: option.value })}
              activeOpacity={0.7}
            >
              <Text style={[tasteStyles.chipText, isSelected && tasteStyles.chipTextOn]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={tasteStyles.question}>What kind of scents do you like?</Text>
      <View style={tasteStyles.chipRow}>
        {SCENT_FAMILIES.map(family => {
          const isSelected = profile.scentFamilies.includes(family);
          return (
            <TouchableOpacity
              key={family}
              style={[tasteStyles.chip, isSelected && tasteStyles.chipOn]}
              onPress={() => toggleFamily(family)}
              activeOpacity={0.7}
            >
              <Text style={[tasteStyles.chipText, isSelected && tasteStyles.chipTextOn]}>
                {family}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const tasteStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 18,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 10, fontWeight: '800', letterSpacing: 2, color: colors.gold },
  caption: { fontSize: 12, color: colors.textMuted, marginTop: 4, marginBottom: 4, lineHeight: 18 },
  question: { fontSize: 14, fontWeight: '600', color: colors.text, marginTop: 14, marginBottom: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.surfaceGold, borderColor: colors.goldDim },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'capitalize',
  },
  chipTextOn: { color: colors.goldBright },
});

// Settings sheet: account management + taste questions live here now,
// keeping the profile tab itself for the social/stats content.
function SettingsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      onDismiss={onClose}
    >
      <View style={styles.settingsContainer}>
        <View style={styles.settingsHeader}>
          <TouchableOpacity onPress={onClose} style={styles.settingsBack} hitSlop={10} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={22} color={colors.goldBright} />
            <Text style={styles.settingsBackText}>Profile</Text>
          </TouchableOpacity>
          <Text style={styles.settingsTitle}>Settings</Text>
          <TouchableOpacity onPress={onClose} hitSlop={10} activeOpacity={0.7}>
            <Text style={styles.settingsDone}>Done</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.settingsSectionLabel}>ACCOUNT</Text>
          <AccountCard />
          <Text style={styles.settingsSectionLabel}>PREFERENCES</Text>
          <TasteProfileCard />
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

export default function ProfileScreen() {
  const { collection, wishlist } = useLibrary();
  const { user } = useAuth();
  const [settingsVisible, setSettingsVisible] = useState(false);

  const stats = useMemo(() => {
    const ratedItems = collection.filter(item => (item.rating ?? 0) > 0);
    const totalWears = collection.reduce((sum, item) => sum + (item.wearCount ?? 0), 0);
    const averageRating =
      ratedItems.length > 0
        ? ratedItems.reduce((sum, item) => sum + (item.rating ?? 0), 0) / ratedItems.length
        : 0;

    const signature = [...ratedItems].sort(
      (a, b) => (b.rating ?? 0) - (a.rating ?? 0) || (b.wearCount ?? 0) - (a.wearCount ?? 0),
    )[0];

    const brandCounts = new Map<string, number>();
    for (const item of collection) {
      brandCounts.set(item.brand, (brandCounts.get(item.brand) ?? 0) + 1);
    }
    const topBrandEntry = [...brandCounts.entries()].sort((a, b) => b[1] - a[1])[0];

    const noteCounts = new Map<string, number>();
    for (const item of collection) {
      const allNotes = [
        ...(item.notes?.top ?? []),
        ...(item.notes?.middle ?? []),
        ...(item.notes?.base ?? []),
      ];
      for (const note of allNotes) {
        const key = note.trim().toLowerCase();
        if (key) {
          noteCounts.set(key, (noteCounts.get(key) ?? 0) + 1);
        }
      }
    }
    const topNotes: NoteFrequency[] = [...noteCounts.entries()]
      .map(([note, count]) => ({ note, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    const seasonCounts = SEASONS.map(season => ({
      season,
      count: collection.filter(item => (item.seasons ?? []).includes(season)).length,
    }));
    const maxSeasonCount = Math.max(1, ...seasonCounts.map(entry => entry.count));

    return {
      totalWears,
      averageRating,
      signature,
      topBrand: topBrandEntry?.[0],
      topBrandCount: topBrandEntry?.[1] ?? 0,
      topNotes,
      maxNoteCount: Math.max(1, ...topNotes.map(entry => entry.count)),
      seasonCounts,
      maxSeasonCount,
      hasSeasonData: seasonCounts.some(entry => entry.count > 0),
    };
  }, [collection]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScreenHeader
        title="Profile"
        subtitle="Your scent story"
        right={
          <TouchableOpacity
            style={styles.settingsBtn}
            onPress={() => setSettingsVisible(true)}
            activeOpacity={0.8}
            hitSlop={6}
          >
            <Ionicons name="settings-outline" size={18} color={colors.goldBright} />
          </TouchableOpacity>
        }
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Identity strip (full account management lives in Settings) */}
        {user ? (
          <View style={styles.identityRow}>
            <Avatar name={user.name} picture={user.picture} size={44} />
            <View style={styles.identityInfo}>
              <Text style={styles.identityName}>{user.name}</Text>
              <Text style={styles.identityCaption}>Synced to your account</Text>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.identityRow}
            onPress={() => setSettingsVisible(true)}
            activeOpacity={0.8}
          >
            <View style={styles.identitySignInIcon}>
              <Ionicons name="person-outline" size={18} color={colors.gold} />
            </View>
            <View style={styles.identityInfo}>
              <Text style={styles.identityName}>Not signed in</Text>
              <Text style={styles.identityCaption}>Sign in from Settings to sync your shelf</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
          </TouchableOpacity>
        )}

        {/* Social cards */}
        <CurrentlyWearingCard />
        <ShowcaseShelf />

        {/* Wear & compliment data */}
        <ComplimentsCard />
        <WearsPerBottleCard />
        <WearTimelineCard />

        {collection.length === 0 && wishlist.length === 0 && (
          <View style={styles.emptyHint}>
            <Ionicons name="sparkles-outline" size={16} color={colors.textFaint} />
            <Text style={styles.emptyHintText}>
              Your stats and signature scent appear here once you start collecting.
            </Text>
          </View>
        )}

        {/* Stat tiles */}
        <View style={styles.statGrid}>
          <View style={styles.statTile}>
            <Text style={styles.statValue}>{collection.length}</Text>
            <Text style={styles.statLabel}>BOTTLES</Text>
          </View>
          <View style={styles.statTile}>
            <Text style={styles.statValue}>{wishlist.length}</Text>
            <Text style={styles.statLabel}>WISHLISTED</Text>
          </View>
          <View style={styles.statTile}>
            <Text style={styles.statValue}>{stats.totalWears}</Text>
            <Text style={styles.statLabel}>WEARS</Text>
          </View>
          <View style={styles.statTile}>
            <Text style={styles.statValue}>
              {stats.averageRating > 0 ? stats.averageRating.toFixed(1) : '—'}
            </Text>
            <Text style={styles.statLabel}>AVG RATING</Text>
          </View>
        </View>

        {/* Signature scent */}
        {stats.signature && (
          <View style={styles.signatureCard}>
            <View style={styles.signatureHeader}>
              <Ionicons name="ribbon-outline" size={14} color={colors.gold} />
              <Text style={styles.signatureEyebrow}>SIGNATURE SCENT</Text>
            </View>
            <View style={styles.signatureBody}>
              {stats.signature.imageUrl ? (
                <Image
                  source={{ uri: stats.signature.imageUrl }}
                  style={styles.signatureImage}
                  contentFit="contain"
                  transition={150}
                />
              ) : (
                <View style={[styles.signatureImage, styles.signatureImageFallback]}>
                  <Ionicons name="flask-outline" size={30} color={colors.goldDim} />
                </View>
              )}
              <View style={styles.signatureInfo}>
                <Text style={type.itemBrand}>{stats.signature.brand}</Text>
                <Text style={styles.signatureName}>{stats.signature.name}</Text>
                <View style={styles.signatureMeta}>
                  <RatingBadge rating={stats.signature.rating} size="large" />
                </View>
                {(stats.signature.wearCount ?? 0) > 0 && (
                  <Text style={styles.signatureWears}>
                    worn {stats.signature.wearCount} {stats.signature.wearCount === 1 ? 'time' : 'times'}
                  </Text>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Top brand */}
        {stats.topBrand && collection.length > 1 && (
          <View style={styles.rowCard}>
            <Ionicons name="business-outline" size={16} color={colors.textMuted} />
            <Text style={styles.rowCardText}>
              Favorite house: <Text style={styles.rowCardStrong}>{stats.topBrand}</Text>
              {stats.topBrandCount > 1 ? ` (${stats.topBrandCount} bottles)` : ''}
            </Text>
          </View>
        )}

        {/* Taste profile — most common notes */}
        {stats.topNotes.length > 0 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>TASTE PROFILE</Text>
            <Text style={styles.sectionCaption}>Notes that show up most in your collection</Text>
            {stats.topNotes.map(entry => (
              <View key={entry.note} style={styles.barRow}>
                <Text style={styles.barLabel} numberOfLines={1}>
                  {entry.note}
                </Text>
                <View style={styles.barTrack}>
                  <View
                    style={[styles.barFill, { flex: entry.count / stats.maxNoteCount }]}
                  />
                  <View style={{ flex: 1 - entry.count / stats.maxNoteCount }} />
                </View>
                <Text style={styles.barCount}>{entry.count}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Season split */}
        {stats.hasSeasonData && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>SEASON SPLIT</Text>
            <Text style={styles.sectionCaption}>How your bottles are tagged by season</Text>
            {stats.seasonCounts.map(entry => (
              <View key={entry.season} style={styles.barRow}>
                <Text style={styles.barLabel}>{entry.season}</Text>
                <View style={styles.barTrack}>
                  <View
                    style={[styles.barFill, { flex: entry.count / stats.maxSeasonCount }]}
                  />
                  <View style={{ flex: 1 - entry.count / stats.maxSeasonCount }} />
                </View>
                <Text style={styles.barCount}>{entry.count}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <SettingsSheet visible={settingsVisible} onClose={() => setSettingsVisible(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: 32 },
  settingsBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: colors.goldDim,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsContainer: { flex: 1, backgroundColor: colors.bg, paddingTop: 8 },
  settingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 8,
  },
  settingsBack: { flexDirection: 'row', alignItems: 'center', gap: 2, minWidth: 80 },
  settingsBackText: { fontSize: 15, fontWeight: '600', color: colors.goldBright },
  settingsTitle: { fontFamily: font.serif, fontSize: 20, fontWeight: '700', color: colors.text },
  settingsDone: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.goldBright,
    minWidth: 80,
    textAlign: 'right',
  },
  settingsSectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    color: colors.textMuted,
    paddingHorizontal: 20,
    marginTop: 10,
    marginBottom: 8,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  identityInfo: { flex: 1, gap: 2 },
  identityName: { fontFamily: font.serif, fontSize: 17, fontWeight: '700', color: colors.text },
  identityCaption: { fontSize: 12, color: colors.textMuted },
  identitySignInIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceGold,
    borderWidth: 1,
    borderColor: colors.goldFaint,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  emptyHintText: { flex: 1, fontSize: 13, color: colors.textFaint, lineHeight: 19 },

  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  statTile: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 18,
    alignItems: 'center',
    gap: 4,
  },
  statValue: { fontFamily: font.serif, fontSize: 28, fontWeight: '700', color: colors.goldBright },
  statLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 2, color: colors.textMuted },

  signatureCard: {
    backgroundColor: colors.surfaceGold,
    borderWidth: 1,
    borderColor: colors.goldFaint,
    borderRadius: radius.lg,
    padding: 18,
    marginHorizontal: 16,
    marginBottom: 10,
    gap: 4,
  },
  signatureHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  signatureEyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 2, color: colors.gold },
  signatureBody: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  signatureImage: {
    width: 80,
    height: 108,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
  },
  signatureImageFallback: {
    backgroundColor: colors.surfaceRaised,
    justifyContent: 'center',
    alignItems: 'center',
  },
  signatureInfo: { flex: 1, gap: 5 },
  signatureName: {
    fontFamily: font.serif,
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  signatureMeta: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 2 },
  signatureWears: { fontSize: 12, color: colors.textMuted, marginTop: 2 },

  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  rowCardText: { fontSize: 14, color: colors.textSecondary, flex: 1 },
  rowCardStrong: { color: colors.text, fontWeight: '700' },

  sectionCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 18,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 10, fontWeight: '800', letterSpacing: 2, color: colors.gold },
  sectionCaption: { fontSize: 12, color: colors.textMuted, marginTop: 4, marginBottom: 14 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  barLabel: {
    width: 90,
    fontSize: 12,
    color: colors.textSecondary,
    textTransform: 'capitalize',
  },
  barTrack: {
    flex: 1,
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
  },
  barFill: { backgroundColor: colors.goldDim, borderRadius: 4 },
  barCount: { width: 20, fontSize: 12, color: colors.textMuted, textAlign: 'right' },
});
