import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import type { SavedFragrance, Season, Occasion } from '../types';
import { SEASONS, OCCASIONS } from '../types';
import { useLibrary } from '../context/LibraryContext';
import { useAuth } from '../context/AuthContext';
import { logWearOnServer } from '../services/api';
import RatingSlider from './RatingSlider';
import TagPills from './TagPills';
import NotesPyramid from './NotesPyramid';
import { colors, font, radius, type } from '../constants/theme';

interface Props {
  item: SavedFragrance | null;
  mode: 'collection' | 'wishlist';
  onClose: () => void;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function FragranceDetailSheet({ item, mode, onClose }: Props) {
  const {
    updateCollectionItem,
    removeFromCollection,
    logWear,
    updateWishlistItem,
    removeFromWishlist,
    moveToCollection,
    sections,
    complimentLog,
    addCompliment,
  } = useLibrary();
  const { token } = useAuth();

  const [reviewDraft, setReviewDraft] = useState('');
  const [loggingWear, setLoggingWear] = useState(false);

  useEffect(() => {
    setReviewDraft(item?.review ?? '');
  }, [item?.slug]);

  if (!item) {
    return null;
  }

  const update = mode === 'collection' ? updateCollectionItem : updateWishlistItem;

  function toggleSeason(value: string) {
    if (!item) {
      return;
    }
    const current = item.seasons ?? [];
    const next = current.includes(value as Season)
      ? current.filter(season => season !== value)
      : [...current, value as Season];
    update(item.slug, { seasons: next });
  }

  function toggleOccasion(value: string) {
    if (!item) {
      return;
    }
    const current = item.occasions ?? [];
    const next = current.includes(value as Occasion)
      ? current.filter(occasion => occasion !== value)
      : [...current, value as Occasion];
    update(item.slug, { occasions: next });
  }

  function saveReview() {
    if (!item) {
      return;
    }
    update(item.slug, { review: reviewDraft.trim() || undefined });
  }

  function handleRemove() {
    if (!item) {
      return;
    }
    if (mode === 'collection') {
      removeFromCollection(item.slug);
    } else {
      removeFromWishlist(item.slug);
    }
    onClose();
  }

  function handleGotIt() {
    if (!item) {
      return;
    }
    moveToCollection(item.slug);
    onClose();
  }

  const wornToday = !!item.lastWornAt
    && new Date(item.lastWornAt).toDateString() === new Date().toDateString();

  // One wear per fragrance per day. Signed in, the server is the referee;
  // signed out, the local last-worn date enforces the same rule.
  async function handleLogWear() {
    if (!item || loggingWear || wornToday) {
      return;
    }
    if (!token) {
      logWear(item.slug);
      return;
    }
    setLoggingWear(true);
    try {
      await logWearOnServer(token, item.slug);
      logWear(item.slug);
    } catch (error: any) {
      Alert.alert('Already logged', error?.message ?? 'You already logged a wear for this today.');
      updateCollectionItem(item.slug, { lastWornAt: Date.now() });
    } finally {
      setLoggingWear(false);
    }
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.backdropTouch} onPress={onClose} activeOpacity={1} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrap}
        >
          <View style={styles.sheet}>
            <View style={styles.grabber} />

            <ScrollView
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Title row */}
              <View style={styles.titleRow}>
                {item.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} style={styles.titleImage} contentFit="contain" transition={120} />
                ) : null}
                <View style={styles.titleBlock}>
                  <Text style={type.eyebrow}>{item.brand}</Text>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.meta}>
                    {mode === 'collection' ? 'In collection' : 'Wishlisted'} since{' '}
                    {formatDate(item.addedAt)}
                  </Text>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={8}>
                  <Ionicons name="close" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Rating — decimal out of 10 */}
              <View style={styles.section}>
                <RatingSlider
                  label={mode === 'collection' ? 'YOUR RATING' : 'HOW BADLY DO YOU WANT IT'}
                  rating={item.rating ?? 0}
                  onChange={value => update(item.slug, { rating: value || undefined })}
                />
              </View>

              {/* Wear tracking (collection only) */}
              {mode === 'collection' && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>WEAR LOG</Text>
                  <View style={styles.wearRow}>
                    <View style={styles.wearStats}>
                      <Text style={styles.wearCount}>{item.wearCount ?? 0}</Text>
                      <Text style={styles.wearCaption}>
                        {item.wearCount === 1 ? 'wear' : 'wears'}
                        {item.lastWornAt ? ` · last ${formatDate(item.lastWornAt)}` : ''}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.wearBtn, (wornToday || loggingWear) && styles.wearBtnDisabled]}
                      onPress={handleLogWear}
                      activeOpacity={0.8}
                      disabled={wornToday || loggingWear}
                    >
                      <Ionicons name={wornToday ? 'checkmark' : 'add'} size={16} color={colors.onGold} />
                      <Text style={styles.wearBtnText}>
                        {wornToday ? 'LOGGED TODAY' : loggingWear ? 'LOGGING…' : 'WORE IT TODAY'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Compliments tracker (collection only) */}
              {mode === 'collection' && (() => {
                const totalCompliments = complimentLog
                  .filter(entry => entry.slug === item.slug)
                  .reduce((sum, entry) => sum + entry.count, 0);
                const today = new Date();
                const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                const todayCompliments = complimentLog
                  .filter(entry => entry.slug === item.slug && entry.date === todayKey)
                  .reduce((sum, entry) => sum + entry.count, 0);
                return (
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>COMPLIMENTS</Text>
                    <View style={styles.wearRow}>
                      <View style={styles.wearStats}>
                        <Text style={styles.wearCount}>{totalCompliments}</Text>
                        <Text style={styles.wearCaption}>
                          total{todayCompliments > 0 ? ` · ${todayCompliments} today` : ''}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.wearBtn, !wornToday && styles.wearBtnDisabled]}
                        onPress={() => addCompliment(item.slug)}
                        activeOpacity={0.8}
                        disabled={!wornToday}
                      >
                        <Ionicons name="heart" size={15} color={colors.onGold} />
                        <Text style={styles.wearBtnText}>GOT A COMPLIMENT</Text>
                      </TouchableOpacity>
                    </View>
                    {!wornToday && (
                      <Text style={styles.complimentHint}>
                        Log a wear today to track compliments — you can't get one without wearing it.
                      </Text>
                    )}
                  </View>
                );
              })()}

              {/* Collection section — move the bottle wherever you like */}
              {mode === 'collection' && sections.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>SECTION</Text>
                  <View style={styles.sectionChipsRow}>
                    <TouchableOpacity
                      style={[styles.sectionChip, !item.sectionId && styles.sectionChipOn]}
                      onPress={() => update(item.slug, { sectionId: undefined })}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.sectionChipText, !item.sectionId && styles.sectionChipTextOn]}>
                        None
                      </Text>
                    </TouchableOpacity>
                    {sections.map(section => {
                      const isSelected = item.sectionId === section.id;
                      return (
                        <TouchableOpacity
                          key={section.id}
                          style={[styles.sectionChip, isSelected && styles.sectionChipOn]}
                          onPress={() => update(item.slug, { sectionId: section.id })}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.sectionChipText, isSelected && styles.sectionChipTextOn]}>
                            {section.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Seasons */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>SEASONS</Text>
                <TagPills options={SEASONS} selected={item.seasons ?? []} onToggle={toggleSeason} />
              </View>

              {/* Occasions */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>OCCASIONS</Text>
                <TagPills
                  options={OCCASIONS}
                  selected={item.occasions ?? []}
                  onToggle={toggleOccasion}
                />
              </View>

              {/* Notes pyramid, when we have a snapshot */}
              {item.notes && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>NOTES</Text>
                  <NotesPyramid notes={item.notes} noteImages={item.noteImages} />
                </View>
              )}

              {/* Review */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>
                  {mode === 'collection' ? 'YOUR REVIEW' : 'WHY YOU WANT IT'}
                </Text>
                <TextInput
                  style={styles.reviewInput}
                  placeholder={
                    mode === 'collection'
                      ? 'Projection, longevity, compliments…'
                      : 'Where you smelled it, what it reminds you of…'
                  }
                  placeholderTextColor={colors.textFaint}
                  value={reviewDraft}
                  onChangeText={setReviewDraft}
                  onBlur={saveReview}
                  onEndEditing={saveReview}
                  multiline
                />
              </View>

              {/* Actions */}
              {mode === 'wishlist' && (
                <TouchableOpacity style={styles.gotItBtn} onPress={handleGotIt} activeOpacity={0.85}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.onGold} />
                  <Text style={styles.gotItText}>GOT IT — MOVE TO COLLECTION</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.removeBtn} onPress={handleRemove} activeOpacity={0.7}>
                <Ionicons name="trash-outline" size={15} color={colors.danger} />
                <Text style={styles.removeText}>
                  Remove from {mode === 'collection' ? 'collection' : 'wishlist'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  backdropTouch: { flex: 1 },
  sheetWrap: { justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surfaceRaised,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '88%',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderLight,
    alignSelf: 'center',
    marginTop: 10,
  },
  content: { padding: 22, paddingBottom: 44 },

  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 4 },
  titleImage: {
    width: 64,
    height: 84,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
  },
  titleBlock: { flex: 1, gap: 5 },
  name: { fontFamily: font.serif, fontSize: 26, fontWeight: '700', color: colors.text, lineHeight: 32 },
  meta: { fontSize: 12, color: colors.textMuted },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },

  section: { marginTop: 22, gap: 10 },
  sectionLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 2, color: colors.textMuted },
  sectionChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sectionChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionChipOn: { backgroundColor: colors.surfaceGold, borderColor: colors.goldDim },
  sectionChipText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  sectionChipTextOn: { color: colors.goldBright },

  wearRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wearStats: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  wearCount: { fontFamily: font.serif, fontSize: 28, fontWeight: '700', color: colors.goldBright },
  wearCaption: { fontSize: 12, color: colors.textMuted },
  wearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.gold,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
  },
  wearBtnDisabled: { opacity: 0.4 },
  wearBtnText: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, color: colors.onGold },
  complimentHint: { fontSize: 11, color: colors.textFaint, lineHeight: 16, marginTop: 8 },

  reviewInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    minHeight: 90,
    fontSize: 14,
    color: colors.text,
    lineHeight: 21,
    textAlignVertical: 'top',
  },

  gotItBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.gold,
    paddingVertical: 14,
    borderRadius: radius.pill,
    marginTop: 26,
  },
  gotItText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, color: colors.onGold },

  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    marginTop: 8,
  },
  removeText: { fontSize: 13, fontWeight: '600', color: colors.danger },
});
