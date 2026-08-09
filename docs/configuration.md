# Configuration

All server config is via environment variables in **`server/.env`** (which is gitignored — safe for secrets). The web client uses a `client/.env.local`. The mobile app has a couple of hardcoded URLs.

## Server (`server/.env`)

| Variable | Default | What it does |
|----------|---------|--------------|
| `PORT` | `3001` | Port the API listens on. |
| `CLIENT_ORIGIN` | `http://localhost:3000` | CORS origin allowed. Locked to this value unless `NODE_ENV=development`. |
| `NODE_ENV` | (unset) | CORS opens to any origin **only** when set to `development`; any other value (including unset) locks CORS to `CLIENT_ORIGIN` — i.e. it fails closed. |
| `ENABLE_DEV_LOGIN` | (unset) | Must be `true` to enable the password-less dev login (`POST /api/auth/dev`). `npm run dev` sets it automatically; **leave it unset in production.** |
| `WHOIS_ENABLED` | **on** | WHOIS domain-age trust checks. **Set to `false` (or `0`) to turn off.** See [whois-and-trust.md](whois-and-trust.md). |
| `GOOGLE_CLIENT_ID` | — | Google OAuth web client ID. Required for Google sign-in. |
| `GOOGLE_CLIENT_SECRET` | — | Its secret. Required for Google sign-in. |
| `SERVER_PUBLIC_URL` | `http://localhost:3001` | The server's own public URL. Used to build the OAuth redirect URI. Set this to your deployed/tunnel URL in production. |

### WHOIS on/off (quick reference)

WHOIS is **on by default**. To turn it off, add to `server/.env`:

```
WHOIS_ENABLED=false
```

…and restart the server. Remove the line (or set `true`) to turn it back on. The logic lives in `server/src/utils/flags.ts` (`whoisEnabled()`), and `GET /api/settings` reports the current state.

### Google OAuth (quick reference)

```
GOOGLE_CLIENT_ID=<id>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<secret>
SERVER_PUBLIC_URL=http://localhost:3001
```

Register `http://localhost:3001/api/auth/google/callback` as an Authorized redirect URI in Google Cloud Console. Full walkthrough in [authentication.md](authentication.md).

## Web client (`client/.env.local`)

| Variable | Default | What it does |
|----------|---------|--------------|
| `VITE_SERVER_URL` | `http://localhost:3001` | Where the website sends API calls. |

## Mobile app (`mobile/services/api.ts`)

The app currently hardcodes two URLs (not env vars yet):

- `BASE_URL` — the API server. In dev it's `http://localhost:3001`; the production branch is a placeholder to replace when you deploy.
- `SNIFFER_WEB_URL` — the Sniffer website, used by the "See prices on Sniffer" button.

For a physical device or a TestFlight build, `BASE_URL` must be a URL the phone can actually reach (LAN IP or deployed HTTPS), and — for Google sign-in — the server's `SERVER_PUBLIC_URL` must match a registered redirect URI. See [authentication.md](authentication.md).

## What's NOT configured anymore

The old `GEMINI_API_KEY` and the AI-search feature were removed entirely (2026-08). There is no LLM/AI dependency in the project. (The photo-identify feature uses a Google Lens *scrape*, not an AI API.)
