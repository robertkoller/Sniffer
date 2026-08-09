import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { initDatabase, purgeExpired } from './db';
import cologneRoutes from './routes/cologne';
import settingsRoutes from './routes/settings';
import storesRoutes from './routes/stores';
import profileRoutes from './routes/profile';
import authRoutes from './routes/auth';
import socialRoutes from './routes/social';
import legalRoutes from './routes/legal';
import { startDailyUpdate } from './jobs/dailyUpdate';
import { prewarmScrapers } from './scrapers/fragrantica';

const app = express();
// Trust the first proxy hop (nginx/Caddy on the VPS) so rate limiting and
// logging see the real client IP from X-Forwarded-For, not the proxy's.
app.set('trust proxy', 1);
const PORT = parseInt(process.env.PORT ?? '3001', 10);
// Bind address. Defaults to all interfaces for local dev (so a phone on the LAN
// can reach the Mac). In production set HOST=127.0.0.1 so the port is reachable
// only by the local reverse proxy (Caddy) and never directly over plain HTTP.
const HOST = process.env.HOST ?? '0.0.0.0';
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? 'http://localhost:3000';

// General rate limit — all endpoints: 100 requests per 15 minutes per IP
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait before trying again.' },
});

// Strict limit for the most expensive endpoints (full search + image identify):
// 5 per 15 minutes per IP. Each one launches a headless browser scrape.
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests for this endpoint. Please wait 15 minutes.' },
});

// Medium limit for the scrape-backed browsing endpoints (suggest/info/prices/
// stores). Cheaper than a full search but still hit third-party services and
// can spawn scrapes on a cache miss, so they need their own ceiling below the
// general 100. Tune as real traffic dictates.
const scrapeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests for this endpoint. Please wait before trying again.' },
});

// Secure-by-default CORS: only open the origin wide in explicit development.
// When NODE_ENV is anything other than "development" (including unset), lock to
// the configured client origin so a misconfigured deploy fails closed.
app.use(cors({
  origin: process.env.NODE_ENV === 'development' ? true : CLIENT_ORIGIN,
}));

// Minimal security headers (Caddy/nginx handles TLS + HSTS in front of this).
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  next();
});

// Rate limit BEFORE parsing bodies so abusive requests are rejected cheaply,
// without buffering their (potentially large) payloads first.
app.use(generalLimiter);
app.use('/api/search', strictLimiter);
app.use('/api/identify', strictLimiter);
app.use(['/api/suggest', '/api/info', '/api/prices', '/api/stores/nearby'], scrapeLimiter);

// Body parsing: the 15 MB ceiling exists only for base64 image uploads on
// /api/identify. Every other endpoint gets a much smaller cap so a single
// request can't buffer 15 MB of JSON into memory.
app.use('/api/identify', express.json({ limit: '15mb' }));
app.use(express.json({ limit: '2mb' }));

app.use('/api', cologneRoutes);
app.use('/api', settingsRoutes);
app.use('/api', storesRoutes);
app.use('/api', profileRoutes);
app.use('/api', authRoutes);
app.use('/api', socialRoutes);
app.use(legalRoutes); // /privacy + /api/legal/privacy

// Health check
app.get('/health', (_, res) => res.json({ status: 'ok' }));

initDatabase();
purgeExpired(); // drop expired sessions / OAuth nonces on boot
startDailyUpdate();
// Warm the browser + Algolia key in the background so the first user request is fast.
void prewarmScrapers();

app.listen(PORT, HOST, () => {
  console.log(`Sniffer server running on http://${HOST}:${PORT}`);
  console.log(`  GET  /api/search?q=<cologne name>`);
  console.log(`  POST /api/identify  { image: "<base64>" }`);
});
