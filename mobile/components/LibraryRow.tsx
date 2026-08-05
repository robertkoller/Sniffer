import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import type { SavedFragrance } from '../types';
import { RatingBadge } from './RatingSlider';
import TagPills from './TagPills';
import { colors, radius, type } from '../constants/theme';

interface Props {
  item: SavedFragrance;
  onPress: () => void;
  rank?: number;
  showPrice?: boolean;
  showWears?: boolean;
}

// Card row used by Collection, Wishlist, and Rankings lists.
export default function LibraryRow({ item, onPress, rank, showPrice = false, showWears = false }: Props) {
  const tags = [...(item.seasons ?? []), ...(item.occasions ?? [])];

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      {rank !== undefined && (
        <Text style={[styles.rank, rank <= 3 && styles.rankTop]}>{rank}</Text>
      )}

      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.image} contentFit="contain" transition={120} />
      ) : (
        <View style={[styles.image, styles.imageFallback]}>
          <Ionicons name="flask-outline" size={18} color={colors.goldDim} />
        </View>
      )}

      <View style={styles.info}>
        <Text style={type.itemBrand}>{item.brand}</Text>
        <Text style={type.itemName} numberOfLines={1}>
          {item.name}
        </Text>

        <View style={styles.metaRow}>
          <RatingBadge rating={item.rating} />
          {showPrice && item.lowestPrice ? (
            <Text style={styles.price}>from {item.lowestPrice}</Text>
          ) : null}
          {showWears && (item.wearCount ?? 0) > 0 ? (
            <Text style={styles.wears}>
              {item.wearCount} {item.wearCount === 1 ? 'wear' : 'wears'}
            </Text>
          ) : null}
        </View>

        {tags.length > 0 && (
          <View style={styles.tagsWrap}>
            <TagPills options={tags} selected={tags} compact />
          </View>
        )}
      </View>

      <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  rank: {
    fontFamily: 'Georgia',
    fontSize: 20,
    fontWeight: '700',
    color: colors.textFaint,
    width: 30,
    textAlign: 'center',
  },
  rankTop: { color: colors.goldBright },
  image: {
    width: 44,
    height: 58,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
  },
  imageFallback: {
    backgroundColor: colors.surfaceRaised,
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: { flex: 1, gap: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  price: { fontSize: 12, fontWeight: '600', color: colors.trusted },
  wears: { fontSize: 12, color: colors.textMuted },
  tagsWrap: { marginTop: 6 },
});
