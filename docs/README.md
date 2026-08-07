# Sniffer & Sniffy — Documentation

This repo holds **two products that share one backend**:

- **Sniffer** — a web app (`client/`) for finding the best prices on a fragrance across many online sellers.
- **Sniffy** — a mobile app (`mobile/`, React Native + Expo) for saving, rating, and socially sharing your fragrance collection (think Letterboxd for cologne).
- **Server** — a Node/Express + SQLite backend (`server/`) that both apps talk to. It does the web scraping, caching, user accounts, and social data.

Everything is written in **TypeScript**.

## Where things live

| Path | What it is |
|------|-----------|
| `server/` | Node/Express API, SQLite DB, web scrapers, auth, social |
| `client/` | Sniffer website (React + Vite + Tailwind) |
| `mobile/` | Sniffy app (React Native + Expo) |
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
- **[authentication.md](authentication.md)** — Google OAuth, sessions, and the dev login.
- **[social-and-profiles.md](social-and-profiles.md)** — the taste profile, library sync, wear logging, and public profiles.
- **[mobile-app.md](mobile-app.md)** — Sniffy's structure: screens, contexts, components.
- **[web-client.md](web-client.md)** — Sniffer's structure: views, components, state.

## One-line mental model

> The **server** scrapes fragrance data + prices and stores accounts; the **website** is the price-comparison front end; the **app** is the personal/social collection front end. Both front ends are thin clients over the same API.
