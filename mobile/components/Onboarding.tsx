import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useProfile } from '../context/ProfileContext';
import { useAuth } from '../context/AuthContext';
import { PRIVACY_POLICY_URL } from '../services/api';
import { SCENT_FAMILIES, type ScentFamily, type GenderPreference } from '../types';
import { colors, font, radius } from '../constants/theme';

const ONBOARDED_KEY = 'sniffy:onboarded';
const AGE_CONFIRMED_KEY = 'sniffy:ageConfirmed';

function PrivacyLink() {
  return (
    <TouchableOpacity
      style={styles.privacyLink}
      onPress={() => Linking.openURL(PRIVACY_POLICY_URL).catch(() => {})}
      hitSlop={8}
    >
      <Text style={styles.privacyLinkText}>Privacy Policy</Text>
    </TouchableOpacity>
  );
}

const GENDER_OPTIONS: Array<{ value: GenderPreference; label: string; caption: string }> = [
  { value: 'men', label: "Men's", caption: 'Show me masculine scents first' },
  { value: 'women', label: "Women's", caption: 'Show me feminine scents first' },
  { value: 'all', label: 'Everything', caption: 'No preference — show it all' },
];

// First-launch flow: taste questions first, then an account prompt.
export default function Onboarding() {
  const { profile, updateProfile } = useProfile();
  const { user, signInWithGoogle, signInDev } = useAuth();

  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState('');
  const [devError, setDevError] = useState<string | null>(null);
  const [ageConfirmed, setAgeConfirmed] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDED_KEY).then(flag => {
      if (!flag) {
        setVisible(true);
      }
    });
    AsyncStorage.getItem(AGE_CONFIRMED_KEY).then(flag => {
      if (flag) {
        setAgeConfirmed(true);
      }
    });
  }, []);

  function confirmAge() {
    setAgeConfirmed(true);
    AsyncStorage.setItem(AGE_CONFIRMED_KEY, '1');
  }

  // Signing in mid-flow counts as finishing
  useEffect(() => {
    if (visible && user && step === 3) {
      finish();
    }
  }, [user, visible, step]);

  function finish() {
    AsyncStorage.setItem(ONBOARDED_KEY, '1');
    setVisible(false);
  }

  function toggleFamily(family: ScentFamily) {
    const next = profile.scentFamilies.includes(family)
      ? profile.scentFamilies.filter(existing => existing !== family)
      : [...profile.scentFamilies, family];
    updateProfile({ scentFamilies: next });
  }

  async function handleDevSignIn() {
    setDevError(null);
    try {
      const trimmed = email.trim();
      await signInDev(trimmed, trimmed.split('@')[0] ?? 'Sniffer');
      finish();
    } catch (error: any) {
      setDevError(error?.message ?? 'Sign-in failed. Is the server running?');
    }
  }

  if (!visible) {
    return null;
  }

  return (
    <Modal visible animationType="fade">
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Progress dots */}
          <View style={styles.dotsRow}>
            {[0, 1, 2, 3].map(dotIndex => (
              <View key={dotIndex} style={[styles.dot, step === dotIndex && styles.dotActive]} />
            ))}
          </View>

          {step === 0 && (
            <>
              <Text style={styles.kicker}>BEFORE WE START</Text>
              <Text style={styles.title}>A quick check</Text>
              <Text style={styles.caption}>
                Sniffy is intended for people aged 13 and older. Please confirm your age. See our
                Privacy Policy for how your data is handled.
              </Text>
              <TouchableOpacity
                style={[styles.optionCard, ageConfirmed && styles.optionCardOn]}
                onPress={() => (ageConfirmed ? setAgeConfirmed(false) : confirmAge())}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={ageConfirmed ? 'checkmark-circle' : 'ellipse-outline'}
                  size={22}
                  color={ageConfirmed ? colors.goldBright : colors.textFaint}
                />
                <Text style={[styles.ageText, ageConfirmed && styles.optionLabelOn]}>
                  I'm 13 years old or older
                </Text>
              </TouchableOpacity>
              <PrivacyLink />
              <TouchableOpacity
                style={[styles.nextBtn, !ageConfirmed && styles.nextBtnDisabled]}
                onPress={() => ageConfirmed && setStep(1)}
                activeOpacity={0.85}
                disabled={!ageConfirmed}
              >
                <Text style={styles.nextBtnText}>CONTINUE</Text>
                <Ionicons name="arrow-forward" size={16} color={colors.onGold} />
              </TouchableOpacity>
            </>
          )}

          {step === 1 && (
            <>
              <Text style={styles.kicker}>WELCOME TO SNIFFY</Text>
              <Text style={styles.title}>What do you wear?</Text>
              <Text style={styles.caption}>
                This shapes your search results — your side of the counter comes first.
              </Text>
              {GENDER_OPTIONS.map(option => {
                const isSelected = profile.genderPreference === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.optionCard, isSelected && styles.optionCardOn]}
                    onPress={() => updateProfile({ genderPreference: option.value })}
                    activeOpacity={0.8}
                  >
                    <View style={styles.optionInfo}>
                      <Text style={[styles.optionLabel, isSelected && styles.optionLabelOn]}>
                        {option.label}
                      </Text>
                      <Text style={styles.optionCaption}>{option.caption}</Text>
                    </View>
                    <Ionicons
                      name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={isSelected ? colors.goldBright : colors.textFaint}
                    />
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity style={styles.nextBtn} onPress={() => setStep(2)} activeOpacity={0.85}>
                <Text style={styles.nextBtnText}>NEXT</Text>
                <Ionicons name="arrow-forward" size={16} color={colors.onGold} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setStep(0)} style={styles.backLink}>
                <Text style={styles.backLinkText}>Back</Text>
              </TouchableOpacity>
            </>
          )}

          {step === 2 && (
            <>
              <Text style={styles.kicker}>YOUR TASTE</Text>
              <Text style={styles.title}>What kind of scents do you like?</Text>
              <Text style={styles.caption}>
                Pick as many as you want — Sniffy flags fragrances that match.
              </Text>
              <View style={styles.familyWrap}>
                {SCENT_FAMILIES.map(family => {
                  const isSelected = profile.scentFamilies.includes(family);
                  return (
                    <TouchableOpacity
                      key={family}
                      style={[styles.familyChip, isSelected && styles.familyChipOn]}
                      onPress={() => toggleFamily(family)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.familyText, isSelected && styles.familyTextOn]}>
                        {family}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity style={styles.nextBtn} onPress={() => setStep(3)} activeOpacity={0.85}>
                <Text style={styles.nextBtnText}>NEXT</Text>
                <Ionicons name="arrow-forward" size={16} color={colors.onGold} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setStep(1)} style={styles.backLink}>
                <Text style={styles.backLinkText}>Back</Text>
              </TouchableOpacity>
            </>
          )}

          {step === 3 && (
            <>
              <Text style={styles.kicker}>ONE LAST THING</Text>
              <Text style={styles.title}>Make it yours</Text>
              <Text style={styles.caption}>
                An account syncs your shelf and unlocks your public scent profile. It works on the
                Sniffer website too.
              </Text>
              <TouchableOpacity style={styles.googleBtn} onPress={signInWithGoogle} activeOpacity={0.85}>
                <Ionicons name="logo-google" size={16} color={colors.onGold} />
                <Text style={styles.nextBtnText}>CONTINUE WITH GOOGLE</Text>
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

              <TouchableOpacity onPress={finish} style={styles.skipLink}>
                <Text style={styles.skipLinkText}>Skip for now</Text>
              </TouchableOpacity>
              <PrivacyLink />
              <TouchableOpacity onPress={() => setStep(2)} style={styles.backLink}>
                <Text style={styles.backLinkText}>Back</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 28, paddingTop: 24, flexGrow: 1 },
  dotsRow: { flexDirection: 'row', gap: 8, marginBottom: 40 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.borderLight },
  dotActive: { backgroundColor: colors.gold, width: 22 },
  kicker: { fontSize: 10, fontWeight: '800', letterSpacing: 2.5, color: colors.gold, marginBottom: 10 },
  title: { fontFamily: font.serif, fontSize: 32, fontWeight: '700', color: colors.text, marginBottom: 12, lineHeight: 38 },
  caption: { fontSize: 14, color: colors.textMuted, lineHeight: 21, marginBottom: 28 },

  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 18,
    marginBottom: 10,
  },
  optionCardOn: { borderColor: colors.goldDim, backgroundColor: colors.surfaceGold },
  optionInfo: { flex: 1, gap: 3 },
  optionLabel: { fontFamily: font.serif, fontSize: 18, fontWeight: '700', color: colors.textSecondary },
  optionLabelOn: { color: colors.text },
  optionCaption: { fontSize: 12, color: colors.textMuted },

  familyWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  familyChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  familyChipOn: { backgroundColor: colors.surfaceGold, borderColor: colors.goldDim },
  familyText: { fontSize: 13, fontWeight: '600', color: colors.textMuted, textTransform: 'capitalize' },
  familyTextOn: { color: colors.goldBright },

  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.gold,
    paddingVertical: 15,
    borderRadius: radius.pill,
    marginTop: 24,
  },
  nextBtnText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, color: colors.onGold },
  nextBtnDisabled: { opacity: 0.4 },
  ageText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary, flex: 1 },
  privacyLink: { alignItems: 'center', paddingVertical: 12 },
  privacyLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.goldDim,
    textDecorationLine: 'underline',
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.gold,
    paddingVertical: 15,
    borderRadius: radius.pill,
  },
  backLink: { alignItems: 'center', paddingVertical: 14 },
  backLinkText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  skipLink: { alignItems: 'center', paddingVertical: 18 },
  skipLinkText: { fontSize: 14, color: colors.goldDim, fontWeight: '600' },

  devBlock: { marginTop: 18 },
  devLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 2, color: colors.textFaint, marginBottom: 8 },
  devRow: { flexDirection: 'row', gap: 8 },
  devInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    fontSize: 13,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  devBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  devError: { fontSize: 12, color: colors.danger, marginTop: 8 },
});
