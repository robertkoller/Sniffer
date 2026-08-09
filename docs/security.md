# Security

The trust boundary is the **server** — the website and both mobile apps are untrusted clients. Everything here lives in `server/src`. Assume every request is hostile.

## Threat model in one line

> Anyone can send any request. The server must authenticate it, authorize it against the *authenticated* user, validate every field, and never let one user touch another user's data or run up unbounded scraping/cost.

## Authentication & sessions

- **Google OAuth 2.0 / OIDC**, server-side authorization-code flow (see [authentication.md](authentication.md)). The `id_token` is read straight from Google's token endpoint over TLS — a documented case where signature verification can be skipped because the token came directly from Google in response to our `client_secret`-authenticated request.
- **Opaque bearer tokens**, 32 random bytes, 90-day TTL. Stored **hashed (SHA-256)** in `sessions` — a DB leak yields nothing usable.
- **Anti-CSRF state nonce**: `/auth/google/start` mints a random single-use `state` and stores the return URL server-side (`oauth_states`, 10-min TTL). `/auth/google/callback` consumes it once; unknown/expired/replayed → 400. The return URL is never taken from the client on callback.
- **Token delivery**: web returns get the token in the URL **fragment** (`#token=`) so it isn't logged or sent in `Referer`; app deep links use the query string.
- **Return-URL allowlist** (`isSafeReturnUrl`): only `sniffy://`, `exp://`/`exps://`, `http://localhost…/`, or the exact configured `CLIENT_ORIGIN`. The check is exact (`===` or `origin + '/'`) so it can't be prefix/suffix/`@`-spoofed.
- **Native token endpoint** (`POST /api/auth/google`) requires `GOOGLE_CLIENT_ID` and always enforces the token `aud`.
- **Dev login** (`POST /api/auth/dev`, password-less "sign in as any email") is **off unless `ENABLE_DEV_LOGIN=true`** — an explicit opt-in independent of `NODE_ENV`, set only by `npm run dev`. It fails closed.

## Authorization (no BOLA/IDOR)

Every mutating and per-user endpoint derives the user id from `authedUser(req)` — the verified session — **never from a client-supplied id**. There are no admin routes and no client-trusted roles. Wear counts are server-authoritative (`wear_logs`); the client's `wearCount` is explicitly ignored on write. The community directory (`/social/users`, `/social/users/:id`) requires auth and is paginated.

## Rate limiting (layered, before body parsing)

Rate limiters run **before** `express.json()` so abusive requests are rejected without buffering their payloads.

| Scope | Limit / 15 min / IP | Endpoints |
|-------|--------------------|-----------|
| General | 100 | everything under `/api` |
| Strict | 5 | `/api/search`, `/api/identify` (each launches a headless-browser scrape) |
| Scrape | 40 | `/api/suggest`, `/api/info`, `/api/prices`, `/api/stores/nearby` |

`trust proxy` is set to `1` (one proxy hop — Caddy/nginx) so limits key on the real client IP. Caching (in-memory suggest cache, DB info/seller cache) blunts repeat cost.

## Input handling

- **Body size**: 2 MB globally; the 15 MB ceiling is scoped to `/api/identify` (base64 images) only.
- **Query params**: `q` strips control chars, collapses whitespace, caps at 120 chars. `lat`/`lng` are parsed and range-checked. `:id` is integer-validated.
- **Library payload** (`PUT /api/social/library`) is strictly sanitized: unknown fields dropped, arrays capped (≤500 items, ≤10 showcase, ≤30 sections, ≤3000 compliment events), strings truncated, ratings clamped to 0–10, and **wear counts never accepted from the client**.
- **SQL**: 100% parameterized (`better-sqlite3` `?`/named params). No string-concatenated SQL anywhere.
- **No shell**: zero `child_process`/`exec`. The only `db.exec` calls use static SQL. WHOIS is RDAP over HTTPS, not the `whois` CLI.
- **SSRF containment**: the one client-supplied URL (`/api/info?url=`) must start with `https://www.fragrantica.com/`; the Overpass/`stores` query interpolates only a constant retailer pattern plus range-checked numbers.

## Transport & headers

- HTTPS/HSTS/TLS termination is the reverse proxy's job (Caddy). **Force HTTP→HTTPS and enable HSTS there.**
- The app sets `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Cross-Origin-Resource-Policy: same-site` on every response.
- **CORS is secure-by-default**: origin is opened to any only when `NODE_ENV=development`; otherwise it's locked to `CLIENT_ORIGIN` (so a misconfigured deploy fails closed). Auth is bearer-token, not cookies, so there's no CSRF surface on the API itself.

## Secrets

`server/.env` is gitignored and untracked. Secrets (`GOOGLE_CLIENT_SECRET`, etc.) are read from env, never logged, and never sent to clients. `.env.example` documents the keys with placeholders.

## Errors & logging

Clients get generic messages; details are `console.error`'d server-side only. No stack traces, SQL errors, or filesystem paths are returned.

## What the audit fixed (changelog)

Round 1: fail-closed dev-login (`ENABLE_DEV_LOGIN`) + CORS default; per-endpoint scrape rate limits moved ahead of body parsing; 15 MB body cap scoped to `/identify`; native-Google `aud` always enforced; `/social/users/:id` no longer scans the whole table; security headers added.

Round 2: session tokens hashed at rest; OAuth `state` is now a real single-use nonce with the return URL held server-side; token returned via URL fragment for web; community directory gated behind auth, paginated, and de-N+1'd (batched wear stats); expired sessions/nonces purged on boot and daily.

## Known follow-ups (not code bugs)

- Set `PRIVACY_CONTACT_EMAIL` before launch (see [privacy-and-age-gate.md](privacy-and-age-gate.md)).
- The public directory exposes names/photos/collections to any signed-in user by design — revisit if profiles should be private.
- Dependencies use `^` ranges; run `npm audit` in CI.
- Add a Terms of Use page (only Privacy exists today).
- Verify HSTS + HTTP→HTTPS redirect at the proxy when you deploy.
