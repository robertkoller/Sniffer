import { chromium, type Browser } from 'playwright';

// Chromium is expensive to launch (~2-4s, worse on a small VPS), so we keep ONE
// instance alive and hand each scrape its own context/page instead of launching
// per request. Contexts are cheap and fully isolated (their own cookies, UA,
// storage), so this doesn't change scraping behaviour — it only removes the
// repeated launch cost that dominated every search.
const LAUNCH_ARGS = [
  '--disable-blink-features=AutomationControlled',
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--no-first-run',
  '--disable-gpu',
];

let sharedBrowser: Browser | null = null;
let launching: Promise<Browser> | null = null;

// Returns the process-wide Chromium, launching it on first use. If the browser
// dies (a crash or OOM on the small box), the cached handle is dropped so the
// next caller relaunches instead of using a dead instance.
export async function getSharedBrowser(): Promise<Browser> {
  if (sharedBrowser && sharedBrowser.isConnected()) {
    return sharedBrowser;
  }
  if (!launching) {
    launching = chromium
      .launch({ headless: true, args: LAUNCH_ARGS })
      .then((browser) => {
        browser.on('disconnected', () => {
          if (sharedBrowser === browser) sharedBrowser = null;
        });
        sharedBrowser = browser;
        launching = null;
        return browser;
      })
      .catch((err) => {
        launching = null;
        throw err;
      });
  }
  return launching;
}

// Best-effort shutdown (e.g. for tests or graceful exit). Normal request paths
// never close the browser — only their own contexts.
export async function closeSharedBrowser(): Promise<void> {
  const browser = sharedBrowser;
  sharedBrowser = null;
  if (browser) {
    await browser.close().catch(() => undefined);
  }
}
