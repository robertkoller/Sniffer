# Sniffer & Sniffy — Documentation

This repo holds **two products that share one backend**:

- **Sniffer** — a web app (`client/`) for finding the best prices on a fragrance across many online sellers.
- **Sniffy** — the collection/social app (think Letterboxd for cologne), in **two implementations**: React Native + Expo (`mobile/`) and a native SwiftUI port (`mobile2/`).
- **Server** — a Node/Express + SQLite backend (`server/`) that all clients talk to. It does the web scraping, caching, user accounts, and social data.

The server and web/RN clients are **TypeScript**; the native app is **Swift/SwiftUI**.

## Where things live

| Path | What it is |
|------|-----------|
| `server/` | Node/Express API, SQLite DB, web scrapers, auth, social |
| `client/` | Sniffer website (React + Vite + Tailwind) |
| `mobile/` | Sniffy app (React Native + Expo) |
| `mobile2/` | Sniffy app, native iOS (Swift / SwiftUI) |
| `db/` | The SQLite database file (`sniffer.db`) lives here at runtime |
| `docs/` | You are here |

## Documentation index

Start here, then dive into whatever you need:

- **[architecture.md](architecture.md)** — the big picture: the three pieces and how they connect.
- **[getting-started.md](getting-started.md)** — how to run the server, website, and app locally.
- **[configuration.md](configuration.md)** — every environment variable and config knob (including **WHOIS_ENABLED**).
- **[api-reference.md](api-reference.md)** — every HTTP endpoint the server exposes.
- **[database.md](database.md)** — the SQLite schema, every table, and how migrations happen.
- **[scrapers.md](scrapers.md)** — how the web scraping pipeline works and its fragile, load-bearing details.
- **[search-flow.md](search-flow.md)** — what happens end-to-end when you search, and all the caching/speed layers.
- **[whois-and-trust.md](whois-and-trust.md)** — how seller trust scoring works, and the WHOIS domain-age check (on by default).
- **[authentication.md](authentication.md)** — Google OAuth (state nonce, fragment token), sessions, and the dev login.
- **[security.md](security.md)** — the full security posture: authz, rate limits, input handling, headers, and the audit changelog.
- **[privacy-and-age-gate.md](privacy-and-age-gate.md)** — the served privacy policy and the 13+ age gate (COPPA) across all clients.
- **[social-and-profiles.md](social-and-profiles.md)** — the taste profile, library sync, wear logging, and public profiles.
- **[mobile-app.md](mobile-app.md)** — Sniffy (React Native): screens, contexts, components.
- **[swift-app.md](swift-app.md)** — Sniffy (native iOS / SwiftUI, `mobile2/`): stores, views, the hand-written Xcode project.
- **[web-client.md](web-client.md)** — Sniffer's structure: views, components, state.

## One-line mental model

> The **server** scrapes fragrance data + prices and stores accounts; the **website** is the price-comparison front end; the **app** is the personal/social collection front end. Both front ends are thin clients over the same API.
