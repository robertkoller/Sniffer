import { Router, Request, Response } from 'express';

const router = Router();

// Bump this (and EFFECTIVE_DATE) whenever the policy text changes, so clients
// that record consent can tell they need to re-prompt.
export const PRIVACY_VERSION = '2026-08-08';
const EFFECTIVE_DATE = 'August 8, 2026';
const MIN_AGE = 13;
const CONTACT_EMAIL = process.env.PRIVACY_CONTACT_EMAIL ?? 'privacy@example.com';

// Single source of truth for the policy body (kept as paragraphs so both the
// HTML page and the JSON endpoint stay in sync).
const SECTIONS: Array<{ heading: string; body: string[] }> = [
  {
    heading: 'Who we are',
    body: [
      'Sniffer (the website) and Sniffy (the mobile app) help you look up fragrances, compare prices, and keep a personal collection. This policy explains what we collect and why.',
    ],
  },
  {
    heading: 'Information we collect',
    body: [
      'Account: if you sign in with Google, we receive your email address, name, and profile picture URL. We do not receive your Google password.',
      'Your library: the fragrances you save (collection and wishlist), ratings, reviews, seasons/occasions tags, sections, wear logs, compliments, and your "currently wearing" and showcase selections.',
      'Preferences: your taste profile (gender preference and scent families) and recent searches.',
      'Search input: fragrance names you search for, and — only if you use photo identification — the image you submit, which is sent to an image-recognition service to identify the bottle and is not stored by us.',
      'Approximate location: only if you use the "nearby stores" feature, your device sends coordinates to find retailers near you. We do not store your location.',
    ],
  },
  {
    heading: 'How we use it',
    body: [
      'To provide the service: run searches, show prices, and sync your collection across your devices and the website.',
      'To personalize: order results by your taste profile and surface scents you may like.',
      'We do not sell your personal information, and we do not use it for advertising.',
    ],
  },
  {
    heading: 'Third parties',
    body: [
      'Google (sign-in / OpenID Connect) for authentication.',
      'Public fragrance and shopping sources used to gather notes, images, and prices.',
      'OpenStreetMap/Overpass for the optional nearby-stores lookup, and RDAP for retailer trust scoring.',
      'These services receive only what is needed to perform their function (for example, a search term or coordinates).',
    ],
  },
  {
    heading: 'Data retention & your choices',
    body: [
      'Your library and profile are stored while your account exists. You can remove items in the app at any time.',
      `You may request access to, or deletion of, your account and associated data by contacting ${CONTACT_EMAIL}.`,
      'Session tokens are stored hashed and expire after 90 days.',
    ],
  },
  {
    heading: "Children's privacy",
    body: [
      `Sniffer and Sniffy are not directed to children under ${MIN_AGE}, and we do not knowingly collect personal information from anyone under ${MIN_AGE}. If you believe a child under ${MIN_AGE} has provided us information, contact ${CONTACT_EMAIL} and we will delete it.`,
    ],
  },
  {
    heading: 'Contact',
    body: [
      `Questions about this policy? Email ${CONTACT_EMAIL}.`,
    ],
  },
];

function renderHtml(): string {
  const body = SECTIONS.map(section => {
    const paragraphs = section.body.map(text => `<p>${escapeHtml(text)}</p>`).join('\n');
    return `<section><h2>${escapeHtml(section.heading)}</h2>\n${paragraphs}</section>`;
  }).join('\n');

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Privacy Policy — Sniffer / Sniffy</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; background: #100E0B; color: #F2EAD9;
    font: 16px/1.65 -apple-system, system-ui, Segoe UI, Roboto, sans-serif; }
  main { max-width: 720px; margin: 0 auto; padding: 48px 22px 80px; }
  h1 { font-family: Georgia, serif; color: #EBC97B; font-size: 30px; margin: 0 0 4px; }
  h2 { font-family: Georgia, serif; color: #D4A94E; font-size: 20px; margin: 34px 0 8px; }
  p { color: #BDAF94; margin: 8px 0; }
  .meta { color: #847A66; font-size: 13px; margin-bottom: 8px; }
  a { color: #EBC97B; }
</style>
</head><body><main>
<h1>Privacy Policy</h1>
<p class="meta">Effective ${EFFECTIVE_DATE} · version ${PRIVACY_VERSION}</p>
${body}
</main></body></html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// GET /privacy — human-readable policy page (linked from both apps + website).
router.get('/privacy', (_req: Request, res: Response) => {
  res.type('html').send(renderHtml());
});

// GET /api/legal/privacy — machine-readable metadata + text for in-app display.
router.get('/api/legal/privacy', (_req: Request, res: Response) => {
  res.json({
    version: PRIVACY_VERSION,
    effectiveDate: EFFECTIVE_DATE,
    minimumAge: MIN_AGE,
    sections: SECTIONS,
  });
});

export default router;
