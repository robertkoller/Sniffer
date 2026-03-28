import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import type { CologneRow, SellerRow, StoreRow, ScentDetails } from './types';

const DB_DIR = path.join(__dirname, '../../db');
const DB_PATH = path.join(DB_DIR, 'sniffer.db');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    fs.mkdirSync(DB_DIR, { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

export function initDatabase(): void {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS colognes (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      slug            TEXT    UNIQUE NOT NULL,
      name            TEXT    NOT NULL,
      brand           TEXT    NOT NULL,
      overview        TEXT,
      notes_top       TEXT    NOT NULL DEFAULT '[]',
      notes_middle    TEXT    NOT NULL DEFAULT '[]',
      notes_base      TEXT    NOT NULL DEFAULT '[]',
      fragrantica_url TEXT,
      last_scraped_at INTEGER,
      created_at      INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS sellers (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      cologne_id       INTEGER NOT NULL,
      name             TEXT    NOT NULL,
      price            TEXT    NOT NULL,
      url              TEXT    NOT NULL,
      credibility_score INTEGER NOT NULL DEFAULT 50,
      is_trusted       INTEGER NOT NULL DEFAULT 0,
      updated_at       INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (cologne_id) REFERENCES colognes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS stores (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      cologne_id INTEGER NOT NULL,
      name       TEXT    NOT NULL,
      location   TEXT,
      url        TEXT,
      FOREIGN KEY (cologne_id) REFERENCES colognes(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_colognes_slug    ON colognes(slug);
    CREATE INDEX IF NOT EXISTS idx_sellers_cologne  ON sellers(cologne_id);
    CREATE INDEX IF NOT EXISTS idx_stores_cologne   ON stores(cologne_id);

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS domain_age_cache (
      domain     TEXT    PRIMARY KEY,
      age_days   INTEGER,
      checked_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);

  // Seed default settings
  db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES ('whois_enabled', '0')`).run();
  db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES ('ai_search_enabled', '0')`).run();

  console.log('Database ready:', DB_PATH);
}

export function getSetting(key: string): string | null {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  getDb().prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

export function getCachedDomainAge(domain: string): number | null | undefined {
  // Returns undefined if not cached, null if cached but lookup failed, number if found
  const CACHE_TTL_DAYS = 30;
  const row = getDb().prepare(
    'SELECT age_days, checked_at FROM domain_age_cache WHERE domain = ?'
  ).get(domain) as { age_days: number | null; checked_at: number } | undefined;
  if (!row) return undefined;
  const staleDays = (Date.now() / 1000 - row.checked_at) / 86400;
  if (staleDays > CACHE_TTL_DAYS) return undefined; // expired
  return row.age_days; // null means lookup was attempted but failed
}

export function cacheDomainAge(domain: string, ageDays: number | null): void {
  getDb().prepare(
    'INSERT OR REPLACE INTO domain_age_cache (domain, age_days, checked_at) VALUES (?, ?, unixepoch())'
  ).run(domain, ageDays);
}

export function getCologneBySlug(slug: string): ScentDetails | null {
  const db = getDb();

  const cologne = db.prepare('SELECT * FROM colognes WHERE slug = ?').get(slug) as CologneRow | undefined;
  if (!cologne) return null;

  const sellers = db.prepare('SELECT * FROM sellers WHERE cologne_id = ? ORDER BY credibility_score DESC').all(cologne.id) as SellerRow[];
  const stores  = db.prepare('SELECT * FROM stores  WHERE cologne_id = ?').all(cologne.id) as StoreRow[];

  return buildScentDetails(cologne, sellers, stores);
}

export function saveCologneWithSellers(
  slug: string,
  cologne: { name: string; brand: string; overview: string; notes: { top: string[]; middle: string[]; base: string[] }; fragrantica_url: string },
  sellers: { name: string; price: string; url: string; credibilityScore: number; isTrusted: boolean }[]
): ScentDetails {
  const db = getDb();

  const insertCologne = db.prepare(`
    INSERT INTO colognes (slug, name, brand, overview, notes_top, notes_middle, notes_base, fragrantica_url, last_scraped_at)
    VALUES (@slug, @name, @brand, @overview, @notes_top, @notes_middle, @notes_base, @fragrantica_url, unixepoch())
    ON CONFLICT(slug) DO UPDATE SET
      name            = excluded.name,
      brand           = excluded.brand,
      overview        = excluded.overview,
      notes_top       = excluded.notes_top,
      notes_middle    = excluded.notes_middle,
      notes_base      = excluded.notes_base,
      fragrantica_url = excluded.fragrantica_url,
      last_scraped_at = unixepoch()
  `);

  insertCologne.run({
    slug,
    name: cologne.name,
    brand: cologne.brand,
    overview: cologne.overview,
    notes_top: JSON.stringify(cologne.notes.top),
    notes_middle: JSON.stringify(cologne.notes.middle),
    notes_base: JSON.stringify(cologne.notes.base),
    fragrantica_url: cologne.fragrantica_url,
  });

  const cologneRow = db.prepare('SELECT * FROM colognes WHERE slug = ?').get(slug) as CologneRow;

  // Replace all sellers for this cologne
  db.prepare('DELETE FROM sellers WHERE cologne_id = ?').run(cologneRow.id);

  const insertSeller = db.prepare(`
    INSERT INTO sellers (cologne_id, name, price, url, credibility_score, is_trusted)
    VALUES (@cologne_id, @name, @price, @url, @credibility_score, @is_trusted)
  `);

  for (const seller of sellers) {
    insertSeller.run({
      cologne_id: cologneRow.id,
      name: seller.name,
      price: seller.price,
      url: seller.url,
      credibility_score: seller.credibilityScore,
      is_trusted: seller.isTrusted ? 1 : 0,
    });
  }

  const sellerRows = db.prepare('SELECT * FROM sellers WHERE cologne_id = ? ORDER BY credibility_score DESC').all(cologneRow.id) as SellerRow[];
  return buildScentDetails(cologneRow, sellerRows, []);
}

export function updateSellersForCologne(cologneId: number, sellers: { name: string; price: string; url: string; credibilityScore: number; isTrusted: boolean }[]): void {
  const db = getDb();
  db.prepare('DELETE FROM sellers WHERE cologne_id = ?').run(cologneId);

  const insertSeller = db.prepare(`
    INSERT INTO sellers (cologne_id, name, price, url, credibility_score, is_trusted)
    VALUES (@cologne_id, @name, @price, @url, @credibility_score, @is_trusted)
  `);

  for (const seller of sellers) {
    insertSeller.run({
      cologne_id: cologneId,
      name: seller.name,
      price: seller.price,
      url: seller.url,
      credibility_score: seller.credibilityScore,
      is_trusted: seller.isTrusted ? 1 : 0,
    });
  }
}

export function getAllColognes(): CologneRow[] {
  return getDb().prepare('SELECT * FROM colognes').all() as CologneRow[];
}

export function clearDatabase(): void {
  const db = getDb();
  db.exec('DELETE FROM sellers; DELETE FROM stores; DELETE FROM colognes;');
  console.log('Database cleared.');
}

export function deleteCologne(slug: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM colognes WHERE slug = ?').run(slug);
  return result.changes > 0;
}

function buildScentDetails(cologne: CologneRow, sellers: SellerRow[], stores: StoreRow[]): ScentDetails {
  // Compute median price across all sellers for value scoring
  const numericPrices = sellers
    .map(s => parseFloat(s.price.replace(/[^0-9.]/g, '')))
    .filter(n => !isNaN(n) && n > 0)
    .sort((a, b) => a - b);
  const mid = Math.floor(numericPrices.length / 2);
  const referencePrice = numericPrices.length === 0 ? 0
    : numericPrices.length % 2 === 0
      ? (numericPrices[mid - 1] + numericPrices[mid]) / 2
      : numericPrices[mid];

  // Value score = trust * price efficiency.
  // Cheaper-than-median entries get a boost; pricier entries are penalised.
  // The price ratio is capped at 2× so ultra-cheap/sketchy sites don't dominate.
  function valueScore(s: SellerRow): number {
    const price = parseFloat(s.price.replace(/[^0-9.]/g, ''));
    if (isNaN(price) || price <= 0 || referencePrice <= 0) return s.credibility_score;
    const priceRatio = Math.min(referencePrice / price, 2);
    return s.credibility_score * priceRatio;
  }

  const sortedSellers = [...sellers].sort((a, b) => valueScore(b) - valueScore(a));

  return {
    name: cologne.name,
    brand: cologne.brand,
    overview: cologne.overview ?? '',
    notes: {
      top:    JSON.parse(cologne.notes_top    || '[]'),
      middle: JSON.parse(cologne.notes_middle || '[]'),
      base:   JSON.parse(cologne.notes_base   || '[]'),
    },
    onlineSellers: sortedSellers.map(s => ({
      name:             s.name,
      price:            s.price,
      url:              s.url,
      credibilityScore: s.credibility_score,
      isTrusted:        s.is_trusted === 1,
    })),
    physicalStores: stores.map(s => ({
      name:     s.name,
      location: s.location ?? undefined,
      url:      s.url ?? '',
    })),
    imagePrompt: `${cologne.brand} ${cologne.name} fragrance bottle`,
    exists: true,
    isUncertain: false,
  };
}
