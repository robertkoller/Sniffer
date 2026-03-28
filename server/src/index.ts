import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { initDatabase } from './db';
import cologneRoutes from './routes/cologne';
import settingsRoutes from './routes/settings';
import storesRoutes from './routes/stores';
import { startDailyUpdate } from './jobs/dailyUpdate';

const app = express();
const PORT = parseInt(process.env.PORT ?? '3001', 10);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? 'http://localhost:3000';

// General rate limit — all endpoints: 100 requests per 15 minutes per IP
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait before trying again.' },
});

// Strict limit for expensive endpoints (search + identify): 5 per 15 minutes per IP
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests for this endpoint. Please wait 15 minutes.' },
});

app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json({ limit: '15mb' })); // Large limit for base64 image uploads

app.use(generalLimiter);
app.use('/api/search', strictLimiter);
app.use('/api/identify', strictLimiter);

app.use('/api', cologneRoutes);
app.use('/api', settingsRoutes);
app.use('/api', storesRoutes);

// Health check
app.get('/health', (_, res) => res.json({ status: 'ok' }));

initDatabase();
startDailyUpdate();

app.listen(PORT, () => {
  console.log(`Sniffer server running on http://localhost:${PORT}`);
  console.log(`  GET  /api/search?q=<cologne name>`);
  console.log(`  POST /api/identify  { image: "<base64>" }`);
});
