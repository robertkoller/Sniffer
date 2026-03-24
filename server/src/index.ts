import express from 'express';
import cors from 'cors';
import { initDatabase } from './db';
import cologneRoutes from './routes/cologne';
import { startDailyUpdate } from './jobs/dailyUpdate';

const app = express();
const PORT = 3001;

app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json({ limit: '15mb' })); // Large limit for base64 image uploads

app.use('/api', cologneRoutes);

// Health check
app.get('/health', (_, res) => res.json({ status: 'ok' }));

initDatabase();
startDailyUpdate();

app.listen(PORT, () => {
  console.log(`Sniffer server running on http://localhost:${PORT}`);
  console.log(`  GET  /api/search?q=<cologne name>`);
  console.log(`  POST /api/identify  { image: "<base64>" }`);
});
