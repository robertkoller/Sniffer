import { Router, Request, Response } from 'express';
import { whoisEnabled } from '../utils/flags';

const router = Router();

// WHOIS is controlled by the WHOIS_ENABLED env var (on by default). This just
// reports the current state for anyone who wants to check it.
router.get('/settings', (_req: Request, res: Response) => {
  res.json({ whoisEnabled: whoisEnabled() });
});

export default router;
