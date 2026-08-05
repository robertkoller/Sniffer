import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLibrary } from '../context/LibraryContext';
import { useProfile } from '../context/ProfileContext';
import { bestFamilyFor } from '../utils/taste';
import { SCENT_FAMILIES, type ScentFamily } from '../types';
import { colors, font, radius } from '../constants/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
}

// Header button that opens the manager
export function ManageSectionsButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.manageBtn} onPress={onPress} activeOpacity={0.8} hitSlop={6}>
      <Ionicons name="folder-open-outline" size={18} color={colors.goldBright} />
    </TouchableOpacity>
  );
}

// Create/delete collection sections, plus one-tap auto-sort by scent type.
export default function SectionManager({ visible, onClose }: Props) {
  const { collection, sections, addSection, removeSection, setSections, updateCollectionItem } = useLibrary();
  const { profile } = useProfile();
  const [newName, setNewName] = useState('');

  function handleAdd() {
    const trimmed = newName.trim();
    if (!trimmed) {
      return;
    }
    addSection(trimmed);
    setNewName('');
  }

  // Group every cologne into a section named after its best-matching scent
  // family (the user's preferred families win ties). Unmatched bottles stay put.
  function autoSortByScentType() {
    const slugsByFamily = new Map<ScentFamily, string[]>();
    for (const item of collection) {
      const family = bestFamilyFor(item.notes, profile.scentFamilies, SCENT_FAMILIES);
      if (family) {
        slugsByFamily.set(family, [...(slugsByFamily.get(family) ?? []), item.slug]);
      }
    }
    if (slugsByFamily.size === 0) {
      return;
    }

    const nextSections = [...sections];
    const sectionIdByFamily = new Map<ScentFamily, string>();
    for (const family of slugsByFamily.keys()) {
      const existing = nextSections.find(section => section.name.toLowerCase() === family.toLowerCase());
      if (existing) {
        sectionIdByFamily.set(family, existing.id);
      } else {
        const id = `${Date.now()}-${family.replace(/[^a-z]/g, '')}`;
        nextSections.push({ id, name: family.charAt(0).toUpperCase() + family.slice(1) });
        sectionIdByFamily.set(family, id);
      }
    }
    setSections(nextSections);
    for (const [family, slugs] of slugsByFamily) {
      const sectionId = sectionIdByFamily.get(family)!;
      for (const slug of slugs) {
        updateCollectionItem(slug, { sectionId });
      }
    }
    onClose();
  }

  function countFor(sectionId: string): number {
    return collection.filter(item => item.sectionId === sectionId).length;
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.backdropTouch} onPress={onClose} activeOpacity={1} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheet}>
            <View style={styles.headerRow}>
              <Text style={styles.title}>Sections</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={8}>
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.autoBtn} onPress={autoSortByScentType} activeOpacity={0.85}>
              <Ionicons name="color-wand-outline" size={16} color={colors.onGold} />
              <Text style={styles.autoBtnText}>AUTO-SORT BY SCENT TYPE</Text>
            </TouchableOpacity>
            <Text style={styles.autoCaption}>
              Creates sections like Woody or Fresh from each bottle's notes — your preferred
              families win ties. You can still move anything afterwards.
            </Text>

            <View style={styles.addRow}>
              <TextInput
                style={styles.addInput}
                placeholder="New section name…"
                placeholderTextColor={colors.textFaint}
                value={newName}
                onChangeText={setNewName}
                onSubmitEditing={handleAdd}
                returnKeyType="done"
              />
              <TouchableOpacity style={styles.addBtn} onPress={handleAdd} activeOpacity={0.8}>
                <Ionicons name="add" size={18} color={colors.onGold} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={sections}
              keyExtractor={section => section.id}
              style={{ flexGrow: 0 }}
              ListEmptyComponent={
                <Text style={styles.emptyText}>
                  No sections yet — add one above or use auto-sort.
                </Text>
              }
              renderItem={({ item: section }) => (
                <View style={styles.sectionRow}>
                  <Ionicons name="folder-outline" size={16} color={colors.gold} />
                  <Text style={styles.sectionName}>{section.name}</Text>
                  <Text style={styles.sectionCount}>{countFor(section.id)}</Text>
                  <TouchableOpacity onPress={() => removeSection(section.id)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={16} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              )}
            />
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  manageBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: colors.goldDim,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  backdropTouch: { flex: 1 },
  sheet: {
    backgroundColor: colors.surfaceRaised,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderLight,
    maxHeight: 560,
    padding: 20,
    paddingBottom: 32,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  title: { fontFamily: font.serif, fontSize: 22, fontWeight: '700', color: colors.text },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  autoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.gold,
    paddingVertical: 12,
    borderRadius: radius.pill,
  },
  autoBtnText: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, color: colors.onGold },
  autoCaption: { fontSize: 11, color: colors.textFaint, lineHeight: 16, marginTop: 8, marginBottom: 16 },
  addRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  addInput: {
    flex: 1,
    height: 42,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  addBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: { fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingVertical: 18 },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionName: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  sectionCount: { fontSize: 12, color: colors.textMuted, marginRight: 6 },
});
