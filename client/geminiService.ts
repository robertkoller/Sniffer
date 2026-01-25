
import { GoogleGenAI, Type } from "@google/genai";
import { ScentDetails, GroundingSource } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function searchCologne(query: string): Promise<ScentDetails | null> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Search for the cologne "${query}". Provide details including brand, a brief AI overview, scent notes (top, middle, base), a list of reputable online sellers with approximate prices, and physical stores where it might be available to sample (like Nordstrom, Sephora, Macy's). Also provide a credibility score for each seller based on general market reputation.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
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
            imagePrompt: { type: Type.STRING, description: "A visual prompt to represent this cologne's aesthetic" }
          },
          required: ["name", "brand", "overview", "notes", "onlineSellers", "physicalStores", "imagePrompt"]
        },
      },
    });

    if (!response.text) {
      return null;
    }

    const result = JSON.parse(response.text);
    
    // Extract grounding sources from groundingMetadata.groundingChunks as required by guidelines
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    const groundingSources: GroundingSource[] = chunks?.map((chunk: any) => {
      if (chunk.web) {
        return {
          title: chunk.web.title,
          url: chunk.web.uri
        };
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
