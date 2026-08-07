# Authentication

One account system, shared by the website and the app. It's **Google OAuth 2.0 / OpenID Connect** using the server-side authorization-code flow, plus a local dev login. Code lives in `server/src/routes/auth.ts`.

## How the Google flow works

1. The user clicks "Sign in with Google". The front end sends them to `GET /api/auth/google/start?return=<url>`, where `return` is where to send them back (the website origin, or the app's `sniffy://auth` deep link).
2. The server redirects to Google's consent screen, built from `GOOGLE_CLIENT_ID` and `redirect_uri = SERVER_PUBLIC_URL/api/auth/google/callback`.
3. Google authenticates the user and redirects to `GET /api/auth/google/callback` with a one-time `code`.
4. The server exchanges the code (using `GOOGLE_CLIENT_SECRET`) for an ID token, reads the user's `sub`/`email`/`name`/`picture`, upserts the user, and issues **its own** opaque 90-day bearer token (a random hex string stored in the `sessions` table).
5. The server redirects the browser to `return?token=<token>`. The front end grabs the token and stores it.

**Key point:** Google only ever sees your **server callback**. The `sniffy://` deep link and the website origin never go into Google Console — only the server callback URI does. So one **Web** OAuth client works for both the website and the app; you do *not* need a separate iOS client.

After sign-in, every request sends `Authorization: Bearer <token>`. `requireAuth` middleware (in `auth.ts`) validates it via `getUserByToken()`, which checks the session hasn't expired.

## Setting up Google OAuth (one-time)

1. **Google Cloud Console** → create/select a project.
2. **OAuth consent screen** → External → app name + your email. Scopes: `openid`, `email`, `profile` (all non-sensitive, no verification needed). In Testing mode, add yourself under Test users.
3. **Credentials → Create OAuth client ID → Web application.**
4. **Authorized redirect URI** → add exactly `http://localhost:3001/api/auth/google/callback` (must match `SERVER_PUBLIC_URL` + `/api/auth/google/callback`). Add your deployed HTTPS callback too when you deploy.
5. Copy the Client ID + Secret into `server/.env`:
   ```
   GOOGLE_CLIENT_ID=<id>.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=<secret>
   SERVER_PUBLIC_URL=http://localhost:3001
   ```
6. Restart the server.

Common errors:
- `redirect_uri_mismatch` → the console URI must exactly match `SERVER_PUBLIC_URL/api/auth/google/callback`.
- 503 "Google sign-in is not configured" → env vars missing or server not restarted.
- "App isn't verified" → normal in Testing mode; sign in as a listed test user.

## OAuth on the iOS app

The mobile flow (`mobile/context/AuthContext.tsx`) opens the system browser to `${BASE_URL}/api/auth/google/start?return=<deep link>`, the server does the dance, then redirects back to the app's `sniffy://auth?token=` deep link, which the app captures.

To make it work on a device, three URLs must agree and be reachable **from the phone**:
- the app's `BASE_URL`,
- the server's `SERVER_PUBLIC_URL`,
- a matching Authorized redirect URI in Google Console.

- **iOS Simulator:** `localhost:3001` works out of the box (shares the Mac network) — nothing extra to configure.
- **Physical device / TestFlight:** use your Mac's LAN IP or (cleaner) an HTTPS tunnel/deploy; set `BASE_URL` + `SERVER_PUBLIC_URL` to it and register its callback. HTTPS avoids iOS App Transport Security issues.

The `sniffy://` URL scheme is already registered in `mobile/app.json`. No native Google SDK is used (the system-browser flow is what Google allows).

## Dev login (no OAuth needed)

`POST /api/auth/dev` with `{ email, name }` issues a real session token without Google. It's **disabled when `NODE_ENV=production`**. The mobile app exposes a dev-login field under `__DEV__`; the website currently only offers Google sign-in (a dev-login button could be added for local testing).

## Sessions & sign-out

- Tokens live 90 days (`sessions.expires_at`).
- `POST /api/auth/logout` deletes the session row.
- The mobile app stores the token in AsyncStorage (`sniffy:authToken`); the website in `localStorage` (`sniffer:authToken`). Both re-validate via `GET /api/auth/me` on load and clear the token if it's invalid.
