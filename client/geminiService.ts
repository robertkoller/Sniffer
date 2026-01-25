
import { GoogleGenAI, Type } from "@google/genai";
import { ScentDetails, GroundingSource } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Identifies a cologne from a base64 image string.
 */
export async function identifyCologneFromImage(base64Image: string): Promise<string | null> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: base64Image.split(',')[1] || base64Image
              }
            },
            {
              text: "Identify this fragrance bottle. Provide ONLY the Brand and Name of the product (e.g., 'Tom Ford Tobacco Vanille'). Do not add any other text."
            }
          ]
        }
      ]
    });

    return response.text?.trim() || null;
  } catch (error) {
    console.error("Error identifying image:", error);
    return null;
  }
}

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
      - Credibility scores (0-100). Be strict: 90+ for authorized dealers, 70-89 for reputable third-party, below 70 for gray market.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            exists: { type: Type.BOOLEAN, description: "True ONLY if a real fragrance product is verified to exist." },
            isUncertain: { type: Type.BOOLEAN, description: "True if the product is very rare or hard to verify." },
            uncertaintyWarning: { type: Type.STRING },
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
