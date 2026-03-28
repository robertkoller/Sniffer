import { Router, Request, Response } from 'express';
import { getSetting, setSetting } from '../db';

const router = Router();

router.get('/settings', (_req: Request, res: Response) => {
  res.json({
    whoisEnabled:     getSetting('whois_enabled') === '1',
    aiSearchEnabled:  getSetting('ai_search_enabled') === '1',
  });
});

router.post('/settings/whois', (req: Request, res: Response) => {
  const { enabled } = req.body as { enabled: boolean };
  setSetting('whois_enabled', enabled ? '1' : '0');
  console.log(`[Settings] WHOIS domain-age checking ${enabled ? 'enabled' : 'disabled'}`);
  res.json({ whoisEnabled: enabled });
});

router.post('/settings/ai', (req: Request, res: Response) => {
  const { enabled } = req.body as { enabled: boolean };
  setSetting('ai_search_enabled', enabled ? '1' : '0');
  console.log(`[Settings] AI seller search ${enabled ? 'enabled' : 'disabled'}`);
  res.json({ aiSearchEnabled: enabled });
});

export default router;
