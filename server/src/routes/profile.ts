import { Router, Request, Response } from 'express';
import { getSetting, setSetting, getUserByToken, saveUserProfile, getUserProfile } from '../db';
import { DEFAULT_PROFILE, SCENT_FAMILIES, type UserProfile, type ScentFamily } from '../types';

const LEGACY_PROFILE_KEY = 'user_profile';
const GENDER_OPTIONS = ['men', 'women', 'all'] as const;

const router = Router();

function parseProfile(raw: string | null): UserProfile {
  if (!raw) {
    return DEFAULT_PROFILE;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<UserProfile>;
    return {
      genderPreference: GENDER_OPTIONS.includes(parsed.genderPreference as any)
        ? parsed.genderPreference as UserProfile['genderPreference']
        : DEFAULT_PROFILE.genderPreference,
      scentFamilies: Array.isArray(parsed.scentFamilies)
        ? parsed.scentFamilies.filter((family): family is ScentFamily =>
            (SCENT_FAMILIES as readonly string[]).includes(family))
        : [],
    };
  } catch {
    return DEFAULT_PROFILE;
  }
}

function tokenFromRequest(req: Request): string {
  const header = req.headers.authorization ?? '';
  return header.startsWith('Bearer ') ? header.slice(7) : '';
}

// Resolve the taste profile for a request: the signed-in user's own profile
// when a valid token is present, else the legacy single-user profile.
export function profileForRequest(req: Request): UserProfile {
  const token = tokenFromRequest(req);
  if (token) {
    const user = getUserByToken(token);
    if (user) {
      return parseProfile(getUserProfile(user.id));
    }
  }
  return parseProfile(getSetting(LEGACY_PROFILE_KEY));
}

// GET /api/profile
router.get('/profile', (req: Request, res: Response) => {
  res.json({ profile: profileForRequest(req), scentFamilyOptions: SCENT_FAMILIES });
});

// PUT /api/profile  — body: { genderPreference?, scentFamilies? }
router.put('/profile', (req: Request, res: Response) => {
  const body = req.body as Partial<UserProfile> | undefined;
  if (!body || typeof body !== 'object') {
    res.status(400).json({ error: 'Missing profile body.' });
    return;
  }

  const current = profileForRequest(req);
  const next: UserProfile = {
    genderPreference: GENDER_OPTIONS.includes(body.genderPreference as any)
      ? body.genderPreference as UserProfile['genderPreference']
      : current.genderPreference,
    scentFamilies: Array.isArray(body.scentFamilies)
      ? body.scentFamilies.filter((family): family is ScentFamily =>
          (SCENT_FAMILIES as readonly string[]).includes(family))
      : current.scentFamilies,
  };

  const serialized = JSON.stringify(next);
  const token = tokenFromRequest(req);
  const user = token ? getUserByToken(token) : null;
  if (user) {
    saveUserProfile(user.id, serialized);
  } else {
    setSetting(LEGACY_PROFILE_KEY, serialized);
  }
  res.json({ profile: next });
});

export default router;
