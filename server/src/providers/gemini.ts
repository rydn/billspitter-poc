import { GoogleGenAI, Type } from "@google/genai";
import type { Bill } from "../../../shared/types.js";
import { PROMPT, normalizeBill, parseBillJson } from "../bill.js";

const MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

/** Gemini's typed schema, mirroring billJsonSchema in bill.ts. */
const geminiSchema = {
  type: Type.OBJECT,
  properties: {
    merchant: { type: Type.STRING },
    currency: { type: Type.STRING },
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          quantity: { type: Type.NUMBER },
          unitPrice: { type: Type.NUMBER },
          totalPrice: { type: Type.NUMBER },
        },
        required: ["name", "quantity", "unitPrice", "totalPrice"],
      },
    },
    subtotal: { type: Type.NUMBER },
    total: { type: Type.NUMBER },
  },
  required: ["merchant", "currency", "items", "subtotal", "total"],
} as const;

/** Whether a usable Gemini API key is configured. */
export function isGeminiConfigured(): boolean {
  const apiKey = process.env.GEMINI_API_KEY;
  return Boolean(apiKey) && apiKey !== "your-gemini-api-key-here";
}

function getClient(): GoogleGenAI {
  if (!isGeminiConfigured()) {
    throw new Error(
      "GEMINI_API_KEY is not configured. Copy server/.env.example to server/.env and set your key."
    );
  }
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

/** Send a bill image to Gemini and return a structured Bill. */
export async function analyzeWithGemini(
  imageBuffer: Buffer,
  mimeType: string
): Promise<Bill> {
  const ai = getClient();

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { text: PROMPT },
          { inlineData: { mimeType, data: imageBuffer.toString("base64") } },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: geminiSchema,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  try {
    return normalizeBill(parseBillJson(text));
  } catch {
    throw new Error("Gemini returned invalid JSON.");
  }
}
