import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { upsertUser, createSession, getUserByToken, deleteSession, type UserRow } from '../db';

// Google OAuth is activated by setting these in server/.env:
//   GOOGLE_CLIENT_ID=<web client id from Google Cloud Console>
//   GOOGLE_CLIENT_SECRET=<its secret>
// Authorized redirect URI to register: <SERVER_PUBLIC_URL>/api/auth/google/callback
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? '';
const SERVER_PUBLIC_URL = process.env.SERVER_PUBLIC_URL ?? 'http://localhost:3001';
const DEV_LOGIN_ENABLED = process.env.NODE_ENV !== 'production';

const router = Router();

function publicUser(user: UserRow) {
  return { id: user.id, email: user.email, name: user.name, picture: user.picture };
}

function issueToken(userId: number): string {
  const token = crypto.randomBytes(32).toString('hex');
  createSession(userId, token);
  return token;
}

// Only redirect back to places we trust: the two apps (dev + Expo Go) or custom scheme
function isSafeReturnUrl(url: string): boolean {
  return /^(sniffy:\/\/|exp:\/\/|exps:\/\/|http:\/\/localhost(:\d+)?\/)/.test(url);
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const user = token ? getUserByToken(token) : null;
  if (!user) {
    res.status(401).json({ error: 'Not signed in.' });
    return;
  }
  (req as Request & { user: UserRow }).user = user;
  next();
}

export function authedUser(req: Request): UserRow {
  return (req as Request & { user: UserRow }).user;
}

// GET /api/auth/google/start?return=<url> — begin the web OAuth flow.
// Used by both apps; the session token comes back on the return URL.
router.get('/auth/google/start', (req: Request, res: Response) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    res.status(503).json({
      error: 'Google sign-in is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in server/.env.',
    });
    return;
  }
  const returnUrl = (req.query.return as string) ?? '';
  if (!isSafeReturnUrl(returnUrl)) {
    res.status(400).json({ error: 'Invalid return URL.' });
    return;
  }
  const state = Buffer.from(JSON.stringify({ return: returnUrl })).toString('base64url');
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: `${SERVER_PUBLIC_URL}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

// GET /api/auth/google/callback — Google redirects here with a code
router.get('/auth/google/callback', async (req: Request, res: Response) => {
  try {
    const code = req.query.code as string;
    const state = req.query.state as string;
    if (!code || !state) {
      res.status(400).send('Missing code or state.');
      return;
    }
    const { return: returnUrl } = JSON.parse(Buffer.from(state, 'base64url').toString()) as { return: string };
    if (!isSafeReturnUrl(returnUrl)) {
      res.status(400).send('Invalid return URL.');
      return;
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: `${SERVER_PUBLIC_URL}/api/auth/google/callback`,
        grant_type: 'authorization_code',
      }),
    });
    const tokenJson = await tokenResponse.json() as { id_token?: string };
    if (!tokenJson.id_token) {
      res.status(502).send('Google token exchange failed.');
      return;
    }

    // The id_token came straight from Google over TLS — decode its payload
    const payload = JSON.parse(
      Buffer.from(tokenJson.id_token.split('.')[1], 'base64url').toString(),
    ) as { sub: string; email: string; name?: string; picture?: string };

    const user = upsertUser({
      googleSub: payload.sub,
      email: payload.email,
      name: payload.name ?? payload.email.split('@')[0],
      picture: payload.picture,
    });
    const token = issueToken(user.id);

    const separator = returnUrl.includes('?') ? '&' : '?';
    res.redirect(`${returnUrl}${separator}token=${token}`);
  } catch (err) {
    console.error('[Auth] Google callback failed:', err);
    res.status(500).send('Sign-in failed. Please try again.');
  }
});

// POST /api/auth/google  — body: { idToken } (native Google sign-in flows)
router.post('/auth/google', async (req: Request, res: Response) => {
  const { idToken } = req.body as { idToken?: string };
  if (!idToken) {
    res.status(400).json({ error: 'Missing idToken.' });
    return;
  }
  try {
    const infoResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    const info = await infoResponse.json() as { aud?: string; sub?: string; email?: string; name?: string; picture?: string };
    if (!infoResponse.ok || !info.sub || !info.email || (GOOGLE_CLIENT_ID && info.aud !== GOOGLE_CLIENT_ID)) {
      res.status(401).json({ error: 'Invalid Google token.' });
      return;
    }
    const user = upsertUser({
      googleSub: info.sub,
      email: info.email,
      name: info.name ?? info.email.split('@')[0],
      picture: info.picture,
    });
    res.json({ token: issueToken(user.id), user: publicUser(user) });
  } catch (err) {
    console.error('[Auth] Google token verify failed:', err);
    res.status(502).json({ error: 'Could not verify Google token.' });
  }
});

// POST /api/auth/dev — body: { email, name } — local development only
router.post('/auth/dev', (req: Request, res: Response) => {
  if (!DEV_LOGIN_ENABLED) {
    res.status(403).json({ error: 'Dev login is disabled in production.' });
    return;
  }
  const { email, name } = req.body as { email?: string; name?: string };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: 'A valid email is required.' });
    return;
  }
  const user = upsertUser({ email, name: (name ?? '').trim() || email.split('@')[0] });
  res.json({ token: issueToken(user.id), user: publicUser(user) });
});

// GET /api/auth/me
router.get('/auth/me', requireAuth, (req: Request, res: Response) => {
  res.json({ user: publicUser(authedUser(req)) });
});

// POST /api/auth/logout
router.post('/auth/logout', (req: Request, res: Response) => {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (token) {
    deleteSession(token);
  }
  res.json({ ok: true });
});

export default router;
