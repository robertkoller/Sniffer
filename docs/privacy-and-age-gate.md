# Privacy & Age Gate (COPPA)

Covers the served privacy policy and the 13+ age gate present in all three clients.

## Privacy policy — one canonical source

The policy is authored **once** in `server/src/routes/legal.ts` and served by the API, so every client links to the same URL instead of shipping its own copy.

| Endpoint | Returns |
|----------|---------|
| `GET /privacy` | Styled, human-readable HTML page (dark gold theme) |
| `GET /api/legal/privacy` | JSON: `{ version, effectiveDate, minimumAge, sections[] }` for in-app rendering |

The `SECTIONS` array is the single source of truth; both the HTML and the JSON render from it, so they never drift. `PRIVACY_VERSION` + `EFFECTIVE_DATE` are bumped whenever the text changes (clients that record consent can compare the version).

**What it documents:** what we collect (Google account email/name/photo; your library, ratings, reviews, wear logs, tags, taste profile, recent searches; search terms; the photo you submit to identify a bottle — sent to an image service, not stored; approximate coordinates for nearby-stores, not stored), how it's used (provide + personalize; no selling, no ads), third parties (Google, fragrance/price sources, OpenStreetMap/Overpass, RDAP), retention & deletion, children's privacy, and contact.

### Before launch

Set the contact address — the policy falls back to a placeholder otherwise:

```
PRIVACY_CONTACT_EMAIL=you@yourdomain.com
```

Review the wording against your actual data practices — the text was written to match what the code does, but the legal copy is yours to own. (No Terms of Use page exists yet.)

## Age gate (COPPA, 13+)

COPPA means we must not knowingly collect data from children under 13. Each client shows a one-time age confirmation on first run and remembers it.

| Client | Where | Persisted flag |
|--------|-------|----------------|
| Sniffy (Swift, `mobile2/`) | First onboarding step ("A quick check") — 13+ checkbox, disabled **Continue** until ticked, Privacy Policy link. Also a Privacy Policy row in Settings. | `UserDefaults` `sniffy:ageConfirmed` |
| Sniffy (RN, `mobile/`) | First onboarding step, mirrored 1:1. Privacy Policy links in onboarding + Settings. | `AsyncStorage` `sniffy:ageConfirmed` |
| Sniffer (web, `client/`) | Blocking modal overlay on first visit; Privacy Policy links in the modal and footer. | `localStorage` `sniffer:ageConfirmed` |

The gate is intentionally a neutral affirmation ("I'm 13 or older"), the standard lightweight COPPA approach for a general-audience app. It blocks progress until confirmed but doesn't collect a birthdate.

### Where the privacy URL comes from in each client

- Swift: `API.privacyURL` → `\(baseURL)/privacy`
- RN: `PRIVACY_POLICY_URL` in `mobile/services/api.ts` → `${BASE_URL}/privacy`
- Web: `PRIVACY_POLICY_URL` in `client/apiService.ts` → `${SERVER_URL}/privacy`

All three resolve to the API server's `/privacy` in both dev (`localhost:3001`) and production.

## Mental model

> One policy, served by the server; three thin age gates that gate first-run and link to it. Bump `PRIVACY_VERSION` when the text changes; set `PRIVACY_CONTACT_EMAIL` before you ship.
