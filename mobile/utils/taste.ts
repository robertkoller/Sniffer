import type { FragranceNotes, ScentFamily } from '../types';

// Note keywords that signal each scent family. Matching is substring-based
// against lowercased note names, so "Calabrian bergamot" hits "bergamot".
const FAMILY_NOTE_KEYWORDS: Record<ScentFamily, string[]> = {
  'fresh':            ['bergamot', 'mint', 'lavender', 'grapefruit', 'green apple', 'aldehyde', 'neroli'],
  'citrus':           ['lemon', 'bergamot', 'orange', 'grapefruit', 'mandarin', 'lime', 'citrus', 'yuzu', 'petitgrain'],
  'aquatic':          ['sea', 'marine', 'aquatic', 'water', 'salt', 'ozon', 'calone'],
  'warm & spicy':     ['pepper', 'cinnamon', 'cardamom', 'ginger', 'saffron', 'nutmeg', 'clove', 'amber', 'incense', 'labdanum'],
  'woody':            ['cedar', 'sandalwood', 'vetiver', 'oud', 'agarwood', 'oakmoss', 'patchouli', 'wood', 'birch', 'cypress'],
  'sweet & gourmand': ['vanilla', 'tonka', 'caramel', 'chocolate', 'coffee', 'praline', 'honey', 'benzoin', 'sugar', 'almond', 'cacao'],
  'floral':           ['rose', 'jasmine', 'iris', 'violet', 'orange blossom', 'tuberose', 'lily', 'peony', 'geranium', 'ylang'],
  'powdery':          ['iris', 'musk', 'heliotrope', 'powder', 'orris', 'tonka'],
  'leather':          ['leather', 'suede', 'tobacco', 'birch tar', 'styrax'],
  'green':            ['grass', 'green', 'galbanum', 'tea', 'fig', 'basil', 'violet leaf', 'bamboo'],
};

// Best single scent-family match for a fragrance, preferring the user's chosen
// families first. Used by the collection's "auto-sort by scent type".
export function bestFamilyFor(
  notes: FragranceNotes | undefined,
  preferredFamilies: ScentFamily[],
  allFamilies: readonly ScentFamily[],
): ScentFamily | null {
  if (!notes) {
    return null;
  }
  const ordered = [
    ...preferredFamilies,
    ...allFamilies.filter(family => !preferredFamilies.includes(family)),
  ];
  const matches = matchTasteFamilies(notes, ordered);
  return matches[0] ?? null;
}

// Which of the user's preferred scent families does this fragrance hit?
export function matchTasteFamilies(
  notes: FragranceNotes | undefined,
  preferredFamilies: ScentFamily[],
): ScentFamily[] {
  if (!notes || preferredFamilies.length === 0) {
    return [];
  }
  const allNotes = [...notes.top, ...notes.middle, ...notes.base].map(note => note.toLowerCase());
  if (allNotes.length === 0) {
    return [];
  }
  return preferredFamilies.filter(family =>
    FAMILY_NOTE_KEYWORDS[family].some(keyword =>
      allNotes.some(note => note.includes(keyword))),
  );
}
