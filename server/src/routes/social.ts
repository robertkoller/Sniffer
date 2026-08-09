import { Router, Request, Response } from 'express';
import { requireAuth, authedUser } from './auth';
import {
  saveUserLibrary,
  getUserLibrary,
  getUserWithLibraryById,
  listUsersWithLibrariesPage,
  countUsers,
  logWearForUser,
  getWearStatsForUser,
  getWearStatsForUsers,
  getWearHistoryForUser,
  type UserRow,
  type WearStats,
} from '../db';

const router = Router();

interface LibraryNotes {
  top: string[];
  middle: string[];
  base: string[];
}

interface LibraryItem {
  slug: string;
  name: string;
  brand: string;
  imageUrl?: string;
  rating?: number;       // 0–10, one decimal
  review?: string;
  notes?: LibraryNotes;
  noteImages?: Record<string, string>;
  sectionId?: string;
  seasons?: string[];
  occasions?: string[];
  overview?: string;
  addedAt?: number;
}

interface LibrarySection {
  id: string;
  name: string;
}

interface ComplimentEvent {
  slug: string;
  date: string;  // YYYY-MM-DD
  count: number;
}

interface LibraryPayload {
  collection: LibraryItem[];
  wishlist: LibraryItem[];
  currentlyWearingSlug?: string | null;
  showcaseSlugs?: string[];
  sections?: LibrarySection[];
  complimentLog?: ComplimentEvent[];
}

function sanitizeComplimentLog(log: unknown): ComplimentEvent[] {
  if (!Array.isArray(log)) {
    return [];
  }
  return log
    .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object')
    .filter(entry =>
      typeof entry.slug === 'string'
      && typeof entry.date === 'string'
      && /^\d{4}-\d{2}-\d{2}$/.test(entry.date)
      && typeof entry.count === 'number')
    .slice(0, 3000)
    .map(entry => ({
      slug: (entry.slug as string).slice(0, 80),
      date: entry.date as string,
      count: Math.min(Math.max(Math.round(entry.count as number), 1), 99),
    }));
}

function sanitizeSections(sections: unknown): LibrarySection[] {
  if (!Array.isArray(sections)) {
    return [];
  }
  return sections
    .filter((section): section is Record<string, unknown> => !!section && typeof section === 'object')
    .filter(section => typeof section.id === 'string' && typeof section.name === 'string')
    .slice(0, 30)
    .map(section => ({
      id: (section.id as string).slice(0, 40),
      name: (section.name as string).slice(0, 40),
    }));
}

function sanitizeStringList(values: unknown): string[] | undefined {
  if (!Array.isArray(values)) {
    return undefined;
  }
  return values.filter((value): value is string => typeof value === 'string').slice(0, 12).map(value => value.slice(0, 30));
}

function sanitizeNoteList(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }
  return values
    .filter((value): value is string => typeof value === 'string')
    .slice(0, 20)
    .map(value => value.slice(0, 60));
}

function sanitizeNoteImages(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const result: Record<string, string> = {};
  let count = 0;
  for (const [name, url] of Object.entries(value as Record<string, unknown>)) {
    if (count >= 40) {
      break;
    }
    if (typeof url === 'string' && url.startsWith('http')) {
      result[name.slice(0, 60)] = url.slice(0, 300);
      count++;
    }
  }
  return count > 0 ? result : undefined;
}

function sanitizeItems(items: unknown): LibraryItem[] {
  if (!Array.isArray(items)) {
    return [];
  }
  return items
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .filter(item => typeof item.slug === 'string' && typeof item.name === 'string' && typeof item.brand === 'string')
    .slice(0, 500)
    .map(item => {
      const rawRating = typeof item.rating === 'number' ? item.rating : undefined;
      const rawNotes = item.notes as Record<string, unknown> | undefined;
      return {
        slug: item.slug as string,
        name: item.name as string,
        brand: item.brand as string,
        imageUrl: typeof item.imageUrl === 'string' ? item.imageUrl : undefined,
        // Ratings are 0–10 with one decimal; wear counts are NOT accepted from
        // the client — they come exclusively from the server's wear_logs.
        rating: rawRating !== undefined ? Math.round(Math.min(Math.max(rawRating, 0), 10) * 10) / 10 : undefined,
        review: typeof item.review === 'string' ? item.review.slice(0, 2000) : undefined,
        notes: rawNotes && typeof rawNotes === 'object'
          ? {
              top: sanitizeNoteList(rawNotes.top),
              middle: sanitizeNoteList(rawNotes.middle),
              base: sanitizeNoteList(rawNotes.base),
            }
          : undefined,
        noteImages: sanitizeNoteImages(item.noteImages),
        sectionId: typeof item.sectionId === 'string' ? item.sectionId.slice(0, 40) : undefined,
        seasons: sanitizeStringList(item.seasons),
        occasions: sanitizeStringList(item.occasions),
        overview: typeof item.overview === 'string' ? item.overview.slice(0, 4000) : undefined,
        addedAt: typeof item.addedAt === 'number' ? item.addedAt : undefined,
      };
    });
}

function parsePayload(rawPayload: string | null): LibraryPayload {
  if (!rawPayload) {
    return { collection: [], wishlist: [] };
  }
  try {
    const parsed = JSON.parse(rawPayload) as LibraryPayload;
    return {
      collection: sanitizeItems(parsed.collection),
      wishlist: sanitizeItems(parsed.wishlist),
      currentlyWearingSlug: typeof parsed.currentlyWearingSlug === 'string' ? parsed.currentlyWearingSlug : null,
      showcaseSlugs: Array.isArray(parsed.showcaseSlugs)
        ? parsed.showcaseSlugs.filter((slug): slug is string => typeof slug === 'string').slice(0, 10)
        : [],
      sections: sanitizeSections(parsed.sections),
      complimentLog: sanitizeComplimentLog(parsed.complimentLog),
    };
  } catch {
    return { collection: [], wishlist: [] };
  }
}

function buildPublicProfile(user: UserRow, rawPayload: string | null, preloadedStats?: Map<string, WearStats>) {
  const payload = parsePayload(rawPayload);
  const wearStats = preloadedStats ?? getWearStatsForUser(user.id);

  // Overlay server-verified wear counts onto the snapshot
  const collection = payload.collection.map(item => {
    const wears = wearStats.get(item.slug);
    return {
      ...item,
      wearCount: wears?.count ?? 0,
      lastWornOn: wears?.lastWornOn,
    };
  });

  const rated = collection.filter(item => (item.rating ?? 0) > 0);
  const topRated = [...rated]
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || (b.wearCount ?? 0) - (a.wearCount ?? 0))
    .slice(0, 10);

  // The showcase is user-curated; falls back to top rated until they pick
  const chosen = (payload.showcaseSlugs ?? [])
    .map(slug => collection.find(item => item.slug === slug))
    .filter((item): item is (typeof collection)[number] => !!item);
  const showcase = chosen.length > 0 ? chosen : topRated;

  const totalWears = collection.reduce((sum, item) => sum + (item.wearCount ?? 0), 0);
  const averageRating = rated.length > 0
    ? rated.reduce((sum, item) => sum + (item.rating ?? 0), 0) / rated.length
    : 0;
  const currentlyWearing = payload.currentlyWearingSlug
    ? collection.find(item => item.slug === payload.currentlyWearingSlug) ?? null
    : null;
  const totalCompliments = (payload.complimentLog ?? []).reduce((sum, entry) => sum + entry.count, 0);

  return {
    user: { id: user.id, name: user.name, picture: user.picture },
    showcase,
    showcaseIsCurated: chosen.length > 0,
    currentlyWearing,
    stats: {
      bottles: collection.length,
      wishlistCount: payload.wishlist.length,
      totalWears,
      totalCompliments,
      averageRating: Math.round(averageRating * 10) / 10,
    },
  };
}

// PUT /api/social/library — Sniffy pushes the user's library snapshot
router.put('/social/library', requireAuth, (req: Request, res: Response) => {
  const body = req.body as Partial<LibraryPayload> | undefined;
  if (!body || typeof body !== 'object') {
    res.status(400).json({ error: 'Missing library payload.' });
    return;
  }
  const payload: LibraryPayload = {
    collection: sanitizeItems(body.collection),
    wishlist: sanitizeItems(body.wishlist),
    currentlyWearingSlug: typeof body.currentlyWearingSlug === 'string' ? body.currentlyWearingSlug : null,
    showcaseSlugs: Array.isArray(body.showcaseSlugs)
      ? body.showcaseSlugs.filter((slug): slug is string => typeof slug === 'string').slice(0, 10)
      : [],
    sections: sanitizeSections(body.sections),
    complimentLog: sanitizeComplimentLog(body.complimentLog),
  };
  saveUserLibrary(authedUser(req).id, JSON.stringify(payload));
  res.json({ ok: true });
});

// GET /api/social/wears — the signed-in user's full wear history (for graphs
// and account restore). Dates come from the server-authoritative wear_logs.
router.get('/social/wears', requireAuth, (req: Request, res: Response) => {
  res.json({ wears: getWearHistoryForUser(authedUser(req).id) });
});

// GET /api/social/library — full restore payload for the signed-in user.
// Wear counts come from the server's wear_logs, never the stored snapshot.
router.get('/social/library', requireAuth, (req: Request, res: Response) => {
  const user = authedUser(req);
  const payload = parsePayload(getUserLibrary(user.id));
  const wearStats = getWearStatsForUser(user.id);
  const collection = payload.collection.map(item => {
    const wears = wearStats.get(item.slug);
    return {
      ...item,
      wearCount: wears?.count ?? 0,
      lastWornOn: wears?.lastWornOn,
    };
  });
  res.json({ library: { ...payload, collection } });
});

// POST /api/social/wear — body: { slug } — logs one wear, max once per day per
// fragrance. The server date is the only clock that counts.
router.post('/social/wear', requireAuth, (req: Request, res: Response) => {
  const { slug } = req.body as { slug?: string };
  if (!slug || typeof slug !== 'string') {
    res.status(400).json({ error: 'Missing slug.' });
    return;
  }
  const user = authedUser(req);
  const logged = logWearForUser(user.id, slug);
  if (!logged) {
    res.status(409).json({ error: 'Already logged a wear for this fragrance today.' });
    return;
  }
  const stats = getWearStatsForUser(user.id).get(slug);
  res.json({ wearCount: stats?.count ?? 1, lastWornOn: stats?.lastWornOn });
});

// GET /api/social/me — the signed-in user's own public profile
router.get('/social/me', requireAuth, (req: Request, res: Response) => {
  const user = authedUser(req);
  res.json({ profile: buildPublicProfile(user, getUserLibrary(user.id)) });
});

// GET /api/social/users?limit=&offset= — community directory (auth required,
// paginated). Exposes names/photos/collections, so it's gated behind sign-in
// and never returns an unbounded set.
router.get('/social/users', requireAuth, (req: Request, res: Response) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 30, 1), 50);
  const offset = Math.max(parseInt(req.query.offset as string, 10) || 0, 0);

  const rows = listUsersWithLibrariesPage(limit, offset);
  const statsByUser = getWearStatsForUsers(rows.map(row => row.id));
  const users = rows.map(row => {
    const profile = buildPublicProfile(row, row.payload, statsByUser.get(row.id) ?? new Map());
    return {
      user: profile.user,
      bottles: profile.stats.bottles,
      totalWears: profile.stats.totalWears,
      topFragrance: profile.showcase[0] ?? null,
      currentlyWearing: profile.currentlyWearing,
    };
  });
  const total = countUsers();
  res.json({ users, page: { limit, offset, total, hasMore: offset + rows.length < total } });
});

// GET /api/social/users/:id — one user's public profile (auth required)
router.get('/social/users/:id', requireAuth, (req: Request, res: Response) => {
  const userId = parseInt(req.params.id, 10);
  if (!Number.isInteger(userId) || userId <= 0) {
    res.status(400).json({ error: 'Invalid user id.' });
    return;
  }
  const row = getUserWithLibraryById(userId);
  if (!row) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }
  res.json({ profile: buildPublicProfile(row, row.payload) });
});

export default router;
