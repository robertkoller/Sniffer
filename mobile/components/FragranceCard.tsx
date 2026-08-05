import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import type { FragranceNotes, NoteImages } from '../types';
import { makeSlug } from '../utils/slug';
import { matchTasteFamilies } from '../utils/taste';
import { snifferPageUrl } from '../services/api';
import { useLibrary } from '../context/LibraryContext';
import { useProfile } from '../context/ProfileContext';
import NotesPyramid from './NotesPyramid';
import { colors, font, radius, type } from '../constants/theme';

interface Props {
  name: string;
  brand: string;
  year?: number;
  imageUrl?: string;
  overview?: string;
  notes?: FragranceNotes;
  noteImages?: NoteImages;
  detailsLoading?: boolean;
}

// Hero card for a fragrance: identity + image, notes when loaded,
// save actions, and a link to the Sniffer site for prices.
export default function FragranceCard({
  name,
  brand,
  year,
  imageUrl,
  overview,
  notes,
  noteImages,
  detailsLoading = false,
}: Props) {
  const slug = makeSlug(brand, name);
  const { profile } = useProfile();

  const {
    isInCollection,
    isInWishlist,
    addToCollection,
    removeFromCollection,
    addToWishlist,
    removeFromWishlist,
  } = useLibrary();

  const inCollection = isInCollection(slug);
  const inWishlist = isInWishlist(slug);

  const snapshot = { slug, name, brand, imageUrl, notes, noteImages, overview };

  const hasNotes = !!notes && (notes.top.length > 0 || notes.middle.length > 0 || notes.base.length > 0);
  const tasteMatches = matchTasteFamilies(notes, profile.scentFamilies);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} contentFit="contain" transition={120} />
        ) : (
          <View style={[styles.image, styles.imageFallback]}>
            <Ionicons name="flask-outline" size={28} color={colors.goldDim} />
          </View>
        )}
        <View style={styles.headerText}>
          <Text style={type.eyebrow}>{brand}</Text>
          <Text style={styles.name}>{name}</Text>
          {year ? <Text style={styles.year}>{year}</Text> : null}
        </View>
      </View>

      {tasteMatches.length > 0 && (
        <View style={styles.tasteBadge}>
          <Ionicons name="heart" size={12} color={colors.goldBright} />
          <Text style={styles.tasteBadgeText}>
            YOUR TASTE · {tasteMatches.join(' · ').toUpperCase()}
          </Text>
        </View>
      )}

      {overview ? (
        <Text style={styles.overview} numberOfLines={4}>
          {overview}
        </Text>
      ) : null}

      {hasNotes && (
        <View style={styles.notesWrap}>
          <NotesPyramid notes={notes!} noteImages={noteImages} />
        </View>
      )}

      {detailsLoading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.gold} />
          <Text style={styles.loadingText}>Loading notes & details…</Text>
        </View>
      )}

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.btn, inCollection ? styles.btnFilled : styles.btnOutline]}
          onPress={() => (inCollection ? removeFromCollection(slug) : addToCollection(snapshot))}
          activeOpacity={0.8}
        >
          <Ionicons
            name={inCollection ? 'checkmark' : 'add'}
            size={15}
            color={inCollection ? colors.onGold : colors.goldBright}
          />
          <Text style={[styles.btnText, inCollection ? styles.btnTextFilled : styles.btnTextOutline]}>
            {inCollection ? 'IN COLLECTION' : 'COLLECTION'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, inWishlist ? styles.btnFilled : styles.btnOutline]}
          onPress={() => (inWishlist ? removeFromWishlist(slug) : addToWishlist(snapshot))}
          activeOpacity={0.8}
        >
          <Ionicons
            name={inWishlist ? 'bookmark' : 'bookmark-outline'}
            size={14}
            color={inWishlist ? colors.onGold : colors.goldBright}
          />
          <Text style={[styles.btnText, inWishlist ? styles.btnTextFilled : styles.btnTextOutline]}>
            {inWishlist ? 'WISHLISTED' : 'WISHLIST'}
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.snifferBtn}
        onPress={() => Linking.openURL(snifferPageUrl(brand, name)).catch(() => {})}
        activeOpacity={0.85}
      >
        <Ionicons name="pricetags-outline" size={15} color={colors.onGold} />
        <Text style={styles.snifferBtnText}>SEE PRICES ON SNIFFER</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    marginHorizontal: 16,
    marginTop: 16,
  },
  headerRow: { flexDirection: 'row', gap: 16, marginBottom: 14 },
  image: {
    width: 92,
    height: 122,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
  },
  imageFallback: {
    backgroundColor: colors.surfaceRaised,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: { flex: 1, gap: 4, justifyContent: 'center' },
  name: {
    fontFamily: font.serif,
    fontSize: 25,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 31,
  },
  year: { fontSize: 13, color: colors.textMuted },
  tasteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceGold,
    borderWidth: 1,
    borderColor: colors.goldFaint,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 12,
  },
  tasteBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 1, color: colors.goldBright },
  overview: { fontSize: 14, color: colors.textSecondary, lineHeight: 22, marginBottom: 14 },
  notesWrap: { marginBottom: 16 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  loadingText: { fontSize: 13, color: colors.textMuted },
  actions: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  btnOutline: { borderColor: colors.goldDim, backgroundColor: 'transparent' },
  btnFilled: { borderColor: colors.gold, backgroundColor: colors.gold },
  btnText: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  btnTextOutline: { color: colors.goldBright },
  btnTextFilled: { color: colors.onGold },
  snifferBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.gold,
    paddingVertical: 13,
    borderRadius: radius.pill,
  },
  snifferBtnText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, color: colors.onGold },
});
