import { GoogleGenAI } from '@google/genai';

export interface SellerSite {
  name: string;
  url: string;
}

export interface AiSearchResult {
  exists: boolean;
  isUncertain: boolean;
  uncertaintyWarning?: string;
  // Canonical brand + name as Gemini knows them (use these to re-query Fragrantica)
  canonicalName?: string;
  canonicalBrand?: string;
  sellers: SellerSite[];
}

let ai: GoogleGenAI | null = null;

function getAi(): GoogleGenAI {
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not set in environment');
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
}

// Ask Gemini to verify the fragrance and return seller page URLs.
// Returns exists=false if it can't confirm the fragrance is real.
export async function findSellerSites(
  query: string,
): Promise<AiSearchResult> {
  console.log(`[AI Search] Verifying and finding sellers for: "${query}"`);

  const prompt = `You are a fragrance expert. A user searched for: "${query}"

STRICT VERIFICATION PROTOCOL:
1. MUST BE A FRAGRANCE: Verify this is a real, commercially produced cologne, perfume, or EDP/EDT.
2. REALITY CHECK: If search results show generic items (clothing, toys, food) but NO clear evidence of a liquid fragrance product with that name, set "exists" to false.
3. UNCERTAINTY: If the product exists but is extremely rare, discontinued, or results are mixed with non-fragrance items, set "isUncertain" to true and provide an "uncertaintyWarning".
4. HALLUCINATION PREVENTION: Do NOT invent a fragrance to satisfy the query. If it does not exist, set "exists" to false and return an empty sellers array.
5. CANONICAL NAME: Return the exact official brand and fragrance name as it appears on the brand's website.

If the fragrance exists, find 6-10 retailer product page URLs for the 100ml / 3.4oz version.
- Prioritize: 2 authorized department store dealers (Sephora, Nordstrom, Macy's, Bloomingdale's, Neiman Marcus, Ulta, Saks), then reputable third-party fragrance retailers (FragranceNet, FragranceX, Jomashop, Perfumania), then brand's own website.
- Only return real product page URLs — do not guess or construct URLs.
- Prefer https direct product pages, not search pages.

Return a single JSON object matching the schema exactly.`;

  const responseSchema = {
    type: 'object',
    properties: {
      exists:             { type: 'boolean' },
      isUncertain:        { type: 'boolean' },
      uncertaintyWarning: { type: 'string' },
      canonicalName:      { type: 'string' },
      canonicalBrand:     { type: 'string' },
      sellers: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            url:  { type: 'string' },
          },
          required: ['name', 'url'],
        },
      },
    },
    required: ['exists', 'isUncertain', 'sellers'],
  };

  try {
    const response = await getAi().models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema,
      },
    });

    const text = response.text ?? '{}';
    const parsed = JSON.parse(text) as Record<string, unknown>;

    const exists        = Boolean(parsed['exists']);
    const isUncertain   = Boolean(parsed['isUncertain']);
    const warning       = typeof parsed['uncertaintyWarning'] === 'string' ? parsed['uncertaintyWarning'] : undefined;
    const canonicalName  = typeof parsed['canonicalName']  === 'string' ? parsed['canonicalName']  : undefined;
    const canonicalBrand = typeof parsed['canonicalBrand'] === 'string' ? parsed['canonicalBrand'] : undefined;

    const rawSellers = Array.isArray(parsed['sellers']) ? (parsed['sellers'] as Array<Record<string, unknown>>) : [];
    const sellers: SellerSite[] = rawSellers
      .filter(s => typeof s['name'] === 'string' && typeof s['url'] === 'string')
      .map(s => ({ name: s['name'] as string, url: s['url'] as string }));

    console.log(`[AI Search] exists=${exists} isUncertain=${isUncertain} canonical="${canonicalBrand} ${canonicalName}" sellers=${sellers.length}`);

    return { exists, isUncertain, uncertaintyWarning: warning, canonicalName, canonicalBrand, sellers };
  } catch (err) {
    console.error('[AI Search] Gemini error:', err);
    // On error, fall through gracefully (caller will use Bing fallback)
    return { exists: true, isUncertain: false, sellers: [] };
  }
}
