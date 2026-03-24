import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import os from 'os';

export async function identifyFromGoogleLens(base64Image: string): Promise<string> {
  // Write base64 image to a temp file so Playwright can upload it
  const tempPath = path.join(os.tmpdir(), `sniffer_${Date.now()}.jpg`);
  fs.writeFileSync(tempPath, Buffer.from(base64Image, 'base64'));

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  try {
    await page.goto('https://lens.google.com/', { waitUntil: 'domcontentloaded', timeout: 20000 });

    // Google Lens has a hidden file input — set the file directly without clicking
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.waitFor({ timeout: 10000 });
    await fileInput.setInputFiles(tempPath);

    // Wait for the results page to load after upload
    await page.waitForURL(/lens\.google\.com\/search/, { timeout: 30000 });
    await page.waitForTimeout(3000);

    // Extract the identified product/subject from the results page.
    // Google Lens shows a "title" or subject label near the top of results.
    const identified = await page.evaluate((): string => {
      // Possible selectors for the inferred subject/product title
      const selectors = [
        '[data-q]',           // search query Google inferred
        '.rgnuSb',            // subject title class (observed in lens results)
        'h3',                 // result headings
        '.LC20lb',            // standard Google result title
        '[class*="title"]',
      ];

      for (const sel of selectors) {
        const els: Element[] = Array.from(document.querySelectorAll(sel));
        for (const el of els) {
          const text = el.textContent?.trim() ?? '';
          // Skip nav labels / short generic strings
          if (text.length > 5 && text.length < 120) return text;
        }
      }
      return '';
    });

    console.log(`[Google Lens] Identified: "${identified}"`);
    return identified;
  } finally {
    await browser.close();
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
  }
}
