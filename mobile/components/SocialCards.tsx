import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useLibrary } from '../context/LibraryContext';
import { colors, font, radius, type } from '../constants/theme';

function initialsFor(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(word => word[0]!.toUpperCase())
    .join('');
}

export function Avatar({ name, picture, size = 52 }: { name: string; picture?: string | null; size?: number }) {
  if (picture) {
    return <Image source={{ uri: picture }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.surfaceGold,
        borderWidth: 1,
        borderColor: colors.goldDim,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Text style={{ fontFamily: font.serif, fontSize: size * 0.36, fontWeight: '700', color: colors.goldBright }}>
        {initialsFor(name)}
      </Text>
    </View>
  );
}

// Sign-in card (signed out) or identity card (signed in)
export function AccountCard() {
  const { user, signInWithGoogle, signInDev, signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [devError, setDevError] = useState<string | null>(null);

  if (user) {
    return (
      <View style={styles.card}>
        <View style={styles.accountRow}>
          <Avatar name={user.name} picture={user.picture} />
          <View style={styles.accountInfo}>
            <Text style={styles.accountName}>{user.name}</Text>
            <Text style={styles.accountEmail}>{user.email}</Text>
          </View>
          <TouchableOpacity onPress={signOut} hitSlop={8} style={styles.signOutBtn}>
            <Ionicons name="log-out-outline" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  async function handleDevSignIn() {
    setDevError(null);
    try {
      const trimmed = email.trim();
      await signInDev(trimmed, trimmed.split('@')[0] ?? 'Sniffer');
    } catch (error: any) {
      setDevError(error?.message ?? 'Sign-in failed. Is the server running?');
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.signInTitle}>Join the club</Text>
      <Text style={styles.signInCaption}>
        Sign in to sync your shelf and share your scent profile. The same account works on the
        Sniffer website.
      </Text>
      <TouchableOpacity style={styles.googleBtn} onPress={signInWithGoogle} activeOpacity={0.85}>
        <Ionicons name="logo-google" size={16} color={colors.onGold} />
        <Text style={styles.googleBtnText}>CONTINUE WITH GOOGLE</Text>
      </TouchableOpacity>

      {__DEV__ && (
        <View style={styles.devBlock}>
          <Text style={styles.devLabel}>DEV SIGN-IN</Text>
          <View style={styles.devRow}>
            <TextInput
              style={styles.devInput}
              placeholder="you@example.com"
              placeholderTextColor={colors.textFaint}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              onSubmitEditing={handleDevSignIn}
            />
            <TouchableOpacity style={styles.devBtn} onPress={handleDevSignIn} activeOpacity={0.8}>
              <Ionicons name="arrow-forward" size={16} color={colors.onGold} />
            </TouchableOpacity>
          </View>
          {devError ? <Text style={styles.devError}>{devError}</Text> : null}
        </View>
      )}
    </View>
  );
}

// "Currently wearing" card with a picker over the collection
export function CurrentlyWearingCard() {
  const { collection, currentlyWearing, setCurrentlyWearing } = useLibrary();
  const [pickerVisible, setPickerVisible] = useState(false);

  const wearingItem = currentlyWearing
    ? collection.find(item => item.slug === currentlyWearing) ?? null
    : null;

  if (collection.length === 0) {
    return null;
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <Ionicons name="water-outline" size={14} color={colors.gold} />
        <Text style={styles.cardHeaderText}>CURRENTLY WEARING</Text>
      </View>

      {wearingItem ? (
        <View style={styles.wearingRow}>
          {wearingItem.imageUrl ? (
            <Image source={{ uri: wearingItem.imageUrl }} style={styles.wearingImage} contentFit="contain" transition={120} />
          ) : (
            <View style={[styles.wearingImage, styles.imageFallback]}>
              <Ionicons name="flask-outline" size={18} color={colors.goldDim} />
            </View>
          )}
          <View style={styles.wearingInfo}>
            <Text style={type.itemBrand}>{wearingItem.brand}</Text>
            <Text style={styles.wearingName} numberOfLines={1}>{wearingItem.name}</Text>
          </View>
          <TouchableOpacity onPress={() => setPickerVisible(true)} hitSlop={6}>
            <Text style={styles.changeText}>Change</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.pickBtn} onPress={() => setPickerVisible(true)} activeOpacity={0.8}>
          <Ionicons name="add" size={16} color={colors.goldBright} />
          <Text style={styles.pickBtnText}>What are you wearing today?</Text>
        </TouchableOpacity>
      )}

      <Modal visible={pickerVisible} animationType="slide" transparent onRequestClose={() => setPickerVisible(false)}>
        <View style={styles.backdrop}>
          <TouchableOpacity style={styles.backdropTouch} onPress={() => setPickerVisible(false)} activeOpacity={1} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Today's scent</Text>
            <FlatList
              data={collection}
              keyExtractor={item => item.slug}
              style={{ flexGrow: 0 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.pickerRow}
                  onPress={() => {
                    setCurrentlyWearing(item.slug);
                    setPickerVisible(false);
                  }}
                  activeOpacity={0.7}
                >
                  {item.imageUrl ? (
                    <Image source={{ uri: item.imageUrl }} style={styles.pickerImage} contentFit="contain" transition={120} />
                  ) : (
                    <View style={[styles.pickerImage, styles.imageFallback]}>
                      <Ionicons name="flask-outline" size={14} color={colors.goldDim} />
                    </View>
                  )}
                  <View style={styles.wearingInfo}>
                    <Text style={type.itemBrand}>{item.brand}</Text>
                    <Text style={styles.pickerName} numberOfLines={1}>{item.name}</Text>
                  </View>
                  {currentlyWearing === item.slug && (
                    <Ionicons name="checkmark" size={18} color={colors.goldBright} />
                  )}
                </TouchableOpacity>
              )}
            />
            {currentlyWearing && (
              <TouchableOpacity
                style={styles.clearBtn}
                onPress={() => {
                  setCurrentlyWearing(null);
                  setPickerVisible(false);
                }}
              >
                <Text style={styles.clearBtnText}>Clear — not wearing anything</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// The display shelf: up to 10 hand-picked bottles (falls back to top rated
// until the user curates their own). Shows rating and top notes per bottle.
export function ShowcaseShelf() {
  const { collection, showcaseSlugs, toggleShowcase } = useLibrary();
  const [editVisible, setEditVisible] = useState(false);

  const curated = showcaseSlugs
    .map(slug => collection.find(item => item.slug === slug))
    .filter((item): item is (typeof collection)[number] => !!item);

  const fallback = collection
    .filter(item => (item.rating ?? 0) > 0)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || (b.wearCount ?? 0) - (a.wearCount ?? 0))
    .slice(0, 10);

  const shelf = curated.length > 0 ? curated : fallback;

  if (collection.length === 0) {
    return null;
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <Ionicons name="sparkles-outline" size={14} color={colors.gold} />
        <Text style={styles.cardHeaderText}>SHOWCASE</Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={() => setEditVisible(true)} hitSlop={6}>
          <Text style={styles.changeText}>{curated.length > 0 ? 'Edit' : 'Choose'}</Text>
        </TouchableOpacity>
      </View>

      {shelf.length === 0 ? (
        <Text style={styles.shelfEmptyText}>
          Pick up to 10 bottles to show off on your profile.
        </Text>
      ) : (
        <>
          {curated.length === 0 && (
            <Text style={styles.shelfHint}>
              Showing your top rated — tap Choose to curate your own shelf.
            </Text>
          )}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelfRow}>
            {shelf.map((item, index) => (
              <View key={item.slug} style={styles.shelfItem}>
                <View style={styles.shelfImageWrap}>
                  {item.imageUrl ? (
                    <Image source={{ uri: item.imageUrl }} style={styles.shelfImage} contentFit="contain" transition={120} />
                  ) : (
                    <View style={[styles.shelfImage, styles.imageFallback]}>
                      <Ionicons name="flask-outline" size={20} color={colors.goldDim} />
                    </View>
                  )}
                  <View style={styles.shelfRank}>
                    <Text style={styles.shelfRankText}>{index + 1}</Text>
                  </View>
                </View>
                <Text style={styles.shelfName} numberOfLines={1}>{item.name}</Text>
                {(item.rating ?? 0) > 0 && (
                  <Text style={styles.shelfRating}>{item.rating!.toFixed(1)}</Text>
                )}
                {item.notes && item.notes.top.length > 0 && (
                  <Text style={styles.shelfNotes} numberOfLines={2}>
                    {item.notes.top.slice(0, 3).join(' · ')}
                  </Text>
                )}
              </View>
            ))}
          </ScrollView>
        </>
      )}

      {/* Showcase picker */}
      <Modal visible={editVisible} animationType="slide" transparent onRequestClose={() => setEditVisible(false)}>
        <View style={styles.backdrop}>
          <TouchableOpacity style={styles.backdropTouch} onPress={() => setEditVisible(false)} activeOpacity={1} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Curate your showcase</Text>
            <Text style={styles.sheetCaption}>
              {showcaseSlugs.length}/10 chosen — tap to add or remove, in the order you want them shown.
            </Text>
            <FlatList
              data={collection}
              keyExtractor={item => item.slug}
              style={{ flexGrow: 0 }}
              renderItem={({ item }) => {
                const position = showcaseSlugs.indexOf(item.slug);
                const isChosen = position >= 0;
                return (
                  <TouchableOpacity
                    style={styles.pickerRow}
                    onPress={() => toggleShowcase(item.slug)}
                    activeOpacity={0.7}
                  >
                    {item.imageUrl ? (
                      <Image source={{ uri: item.imageUrl }} style={styles.pickerImage} contentFit="contain" transition={120} />
                    ) : (
                      <View style={[styles.pickerImage, styles.imageFallback]}>
                        <Ionicons name="flask-outline" size={14} color={colors.goldDim} />
                      </View>
                    )}
                    <View style={styles.wearingInfo}>
                      <Text style={type.itemBrand}>{item.brand}</Text>
                      <Text style={styles.pickerName} numberOfLines={1}>{item.name}</Text>
                    </View>
                    {isChosen ? (
                      <View style={styles.chosenBadge}>
                        <Text style={styles.chosenBadgeText}>{position + 1}</Text>
                      </View>
                    ) : (
                      <Ionicons name="add-circle-outline" size={20} color={colors.textFaint} />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
            <TouchableOpacity style={styles.doneBtn} onPress={() => setEditVisible(false)} activeOpacity={0.85}>
              <Text style={styles.doneBtnText}>DONE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  cardHeaderText: { fontSize: 10, fontWeight: '800', letterSpacing: 2, color: colors.gold },

  accountRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  accountInfo: { flex: 1, gap: 2 },
  accountName: { fontFamily: font.serif, fontSize: 20, fontWeight: '700', color: colors.text },
  accountEmail: { fontSize: 12, color: colors.textMuted },
  signOutBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceRaised,
    justifyContent: 'center',
    alignItems: 'center',
  },

  signInTitle: { fontFamily: font.serif, fontSize: 21, fontWeight: '700', color: colors.text, marginBottom: 6 },
  signInCaption: { fontSize: 13, color: colors.textMuted, lineHeight: 20, marginBottom: 14 },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.gold,
    paddingVertical: 13,
    borderRadius: radius.pill,
  },
  googleBtnText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, color: colors.onGold },
  devBlock: { marginTop: 14 },
  devLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 2, color: colors.textFaint, marginBottom: 8 },
  devRow: { flexDirection: 'row', gap: 8 },
  devInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    fontSize: 13,
    color: colors.text,
    backgroundColor: colors.surfaceRaised,
  },
  devBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  devError: { fontSize: 12, color: colors.danger, marginTop: 8 },

  wearingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  wearingImage: { width: 48, height: 62, borderRadius: radius.sm, backgroundColor: colors.white },
  imageFallback: { backgroundColor: colors.surfaceRaised, justifyContent: 'center', alignItems: 'center' },
  wearingInfo: { flex: 1, gap: 2 },
  wearingName: { fontFamily: font.serif, fontSize: 18, fontWeight: '700', color: colors.text },
  changeText: { fontSize: 13, fontWeight: '600', color: colors.goldBright },
  pickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.goldDim,
    borderRadius: radius.pill,
    paddingVertical: 12,
  },
  pickBtnText: { fontSize: 13, fontWeight: '600', color: colors.goldBright },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  backdropTouch: { flex: 1 },
  sheet: {
    backgroundColor: colors.surfaceRaised,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderLight,
    maxHeight: 480,
    padding: 20,
    paddingBottom: 32,
  },
  sheetTitle: { fontFamily: font.serif, fontSize: 21, fontWeight: '700', color: colors.text, marginBottom: 14 },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerImage: { width: 36, height: 46, borderRadius: 6, backgroundColor: colors.white },
  pickerName: { fontFamily: font.serif, fontSize: 16, fontWeight: '700', color: colors.text },
  clearBtn: { alignItems: 'center', paddingTop: 16 },
  clearBtnText: { fontSize: 13, fontWeight: '600', color: colors.danger },

  shelfRow: { gap: 14, paddingRight: 6 },
  shelfItem: { width: 92, alignItems: 'center' },
  shelfImageWrap: { position: 'relative' },
  shelfImage: { width: 76, height: 100, borderRadius: radius.sm, backgroundColor: colors.white },
  shelfRank: {
    position: 'absolute',
    top: -6,
    left: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shelfRankText: { fontFamily: font.serif, fontSize: 12, fontWeight: '700', color: colors.onGold },
  shelfName: { fontSize: 11, fontWeight: '600', color: colors.textSecondary, marginTop: 6, maxWidth: 92 },
  shelfRating: { fontFamily: font.serif, fontSize: 12, fontWeight: '700', color: colors.goldBright, marginTop: 2 },
  shelfNotes: {
    fontSize: 9,
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: 2,
    lineHeight: 12,
  },
  shelfEmptyText: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  shelfHint: { fontSize: 11, color: colors.textFaint, marginBottom: 10 },
  sheetCaption: { fontSize: 12, color: colors.textMuted, marginBottom: 12, marginTop: -8 },
  chosenBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chosenBadgeText: { fontFamily: font.serif, fontSize: 12, fontWeight: '700', color: colors.onGold },
  doneBtn: {
    backgroundColor: colors.gold,
    borderRadius: radius.pill,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 14,
  },
  doneBtnText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, color: colors.onGold },
});
