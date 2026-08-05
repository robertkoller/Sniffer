// Sniffy design system — dark, warm, editorial. Gold on near-black.

export const colors = {
  // Surfaces
  bg:            '#100E0B',
  surface:       '#1A1712',
  surfaceRaised: '#221E17',
  surfaceGold:   '#2A2416',

  // Lines
  border:        '#2B2620',
  borderLight:   '#3A342B',

  // Gold accent scale
  gold:          '#D4A94E',
  goldBright:    '#EBC97B',
  goldDim:       '#8A7340',
  goldFaint:     '#4A3F26',

  // Text
  text:          '#F2EAD9',
  textSecondary: '#BDAF94',
  textMuted:     '#847A66',
  textFaint:     '#5C5546',

  // Semantic
  trusted:       '#8FBC7F',
  trustedDim:    '#2A3324',
  danger:        '#D08770',
  dangerDim:     '#3A2721',

  // On-gold
  onGold:        '#1A1509',

  white:         '#FFFFFF',
  black:         '#000000',
};

export const radius = {
  sm:   8,
  md:   14,
  lg:   20,
  xl:   28,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
};

export const font = {
  serif: 'Georgia',
  sans:  'System',
};

// Shared text styles
export const type = {
  screenTitle: {
    fontFamily: font.serif,
    fontSize: 30,
    fontWeight: '700' as const,
    color: colors.text,
    letterSpacing: 0.3,
  },
  screenSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    letterSpacing: 0.2,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800' as const,
    letterSpacing: 2.5,
    color: colors.gold,
    textTransform: 'uppercase' as const,
  },
  itemBrand: {
    fontSize: 10,
    fontWeight: '800' as const,
    letterSpacing: 2,
    color: colors.textMuted,
    textTransform: 'uppercase' as const,
  },
  itemName: {
    fontFamily: font.serif,
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.text,
  },
};
