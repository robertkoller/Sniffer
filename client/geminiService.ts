
import { GoogleGenAI, Type } from "@google/genai";
import { ScentDetails, GroundingSource } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function searchCologne(query: string): Promise<ScentDetails | null> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are an expert fragrance fact-checker. 
      Query: "${query}"

      STRICT SEARCH & VERIFICATION PROTOCOL:
      1. MUST BE A FRAGRANCE: Verify if this is a real, commercially produced cologne, perfume, or EDP.
      2. REALITY CHECK: If you find search results for generic items (e.g., Shrek toys, Firefighter costumes) but NO clear evidence of a liquid fragrance product with that name, set "exists" to false.
      3. UNCERTAINTY: If you find the product exists but it is extremely rare, a discontinued novelty, or search results are mixed with non-fragrance items, set "isUncertain" to true and provide a "uncertaintyWarning".
      4. HALLUCINATION PREVENTION: Do NOT create a product like "Firefighter for Men" just to satisfy the query. If it doesn't exist in reality, set "exists" to false.
      5. Make sure the 100ml (3.4 oz) price is the one used, not any testing amount.
      
      REQUIRED DATA:
      - Scent pyramid (top, middle, base).
      - RETAILER LIST: 12-15 retailers. Prioritize direct product pages.
      - Exact prices from search snippets.
      - Credibility scores (0-100).`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            exists: { type: Type.BOOLEAN, description: "True ONLY if a real fragrance product is verified to exist." },
            isUncertain: { type: Type.BOOLEAN, description: "True if the product is very rare, hard to verify, or has mixed search results." },
            uncertaintyWarning: { type: Type.STRING, description: "A message explaining why the results might be unreliable (e.g. 'This is a rare novelty item')." },
            name: { type: Type.STRING },
            brand: { type: Type.STRING },
            overview: { type: Type.STRING },
            notes: {
              type: Type.OBJECT,
              properties: {
                top: { type: Type.ARRAY, items: { type: Type.STRING } },
                middle: { type: Type.ARRAY, items: { type: Type.STRING } },
                base: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
              required: ["top", "middle", "base"]
            },
            onlineSellers: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  price: { type: Type.STRING },
                  url: { type: Type.STRING },
                  credibilityScore: { type: Type.NUMBER },
                  isTrusted: { type: Type.BOOLEAN },
                },
                required: ["name", "price", "url", "credibilityScore", "isTrusted"]
              }
            },
            physicalStores: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  url: { type: Type.STRING }
                },
                required: ["name", "url"]
              }
            },
            imagePrompt: { type: Type.STRING }
          },
          required: ["exists", "isUncertain", "name", "brand", "overview", "notes", "onlineSellers", "physicalStores", "imagePrompt"]
        },
      },
    });

    if (!response.text) return null;

    const result = JSON.parse(response.text);
    
    // If the model explicitly says the product doesn't exist or isn't a fragrance
    if (result.exists === false) {
      return null;
    }

    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    const groundingSources: GroundingSource[] = chunks?.map((chunk: any) => {
      if (chunk.web) {
        return { title: chunk.web.title, url: chunk.web.uri };
      }
      return null;
    }).filter((s: any): s is GroundingSource => s !== null) || [];

    return {
      ...result,
      groundingSources
    };
  } catch (error) {
    console.error("Error searching cologne:", error);
    return null;
  }
}
