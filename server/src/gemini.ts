import { GoogleGenAI, Type } from "@google/genai";
import { randomUUID } from "node:crypto";
import type { Bill, LineItem } from "../../shared/types.js";

const DEFAULT_CURRENCY = "ZAR";
const MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

/**
 * Lazily create the Gemini client so the process can start (and report a clear
 * error) even if the key is missing, rather than throwing at import time.
 */
function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your-gemini-api-key-here") {
    throw new Error(
      "GEMINI_API_KEY is not configured. Copy server/.env.example to server/.env and set your key."
    );
  }
  return new GoogleGenAI({ apiKey });
}

const billResponseSchema = {
  type: Type.OBJECT,
  properties: {
    merchant: {
      type: Type.STRING,
      description: "Restaurant or merchant name, empty string if not visible.",
    },
    currency: {
      type: Type.STRING,
      description:
        "ISO-4217 currency code such as ZAR, USD, EUR. Empty string if unknown.",
    },
    items: {
      type: Type.ARRAY,
      description: "Every individual line item ordered on the bill.",
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "Item name." },
          quantity: {
            type: Type.NUMBER,
            description: "Quantity ordered. Use 1 if not shown.",
          },
          unitPrice: {
            type: Type.NUMBER,
            description: "Price per single unit.",
          },
          totalPrice: {
            type: Type.NUMBER,
            description: "Total price for this line (quantity * unitPrice).",
          },
        },
        required: ["name", "quantity", "unitPrice", "totalPrice"],
      },
    },
    subtotal: {
      type: Type.NUMBER,
      description: "Subtotal before tip. Use 0 if not shown.",
    },
    total: {
      type: Type.NUMBER,
      description: "Grand total as printed. Use 0 if not shown.",
    },
  },
  required: ["merchant", "currency", "items", "subtotal", "total"],
} as const;

const PROMPT = [
  "You are a precise bill/receipt parser.",
  "Extract every individual line item from this restaurant bill image.",
  "Prices already include tax; do not add or remove tax.",
  "Do not include tip, tax, service charge, subtotal, or total rows as line items.",
  "If a quantity is not shown, use 1. Compute totalPrice as quantity * unitPrice when only a unit price is visible.",
  "Detect the currency code if possible; otherwise return an empty string.",
].join(" ");

interface RawBill {
  merchant?: string;
  currency?: string;
  items?: Array<{
    name?: string;
    quantity?: number;
    unitPrice?: number;
    totalPrice?: number;
  }>;
  subtotal?: number;
  total?: number;
}

function toNumber(value: unknown, fallback = 0): number {
  const n = typeof value === "string" ? Number(value) : (value as number);
  return Number.isFinite(n) ? (n as number) : fallback;
}

/** Normalize the model output into a well-formed Bill with stable ids. */
function normalizeBill(raw: RawBill): Bill {
  const items: LineItem[] = (raw.items ?? [])
    .map((item) => {
      const quantity = Math.max(1, toNumber(item.quantity, 1));
      const unitPrice = toNumber(item.unitPrice, 0);
      const totalPrice = toNumber(
        item.totalPrice,
        Math.round(unitPrice * quantity * 100) / 100
      );
      return {
        id: randomUUID(),
        name: (item.name ?? "Item").trim() || "Item",
        quantity,
        unitPrice,
        totalPrice,
      };
    })
    .filter((item) => item.totalPrice > 0 || item.unitPrice > 0);

  const subtotal =
    toNumber(raw.subtotal, 0) ||
    Math.round(items.reduce((sum, i) => sum + i.totalPrice, 0) * 100) / 100;

  return {
    merchant: raw.merchant?.trim() || undefined,
    currency: (raw.currency ?? "").trim().toUpperCase() || DEFAULT_CURRENCY,
    items,
    subtotal,
    total: toNumber(raw.total, 0) || subtotal,
  };
}

/**
 * Send a bill image to Gemini and return a structured Bill.
 *
 * @param imageBuffer raw image bytes
 * @param mimeType    e.g. "image/jpeg" or "image/png"
 */
export async function analyzeBill(
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
          {
            inlineData: {
              mimeType,
              data: imageBuffer.toString("base64"),
            },
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: billResponseSchema,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  let raw: RawBill;
  try {
    raw = JSON.parse(text) as RawBill;
  } catch {
    throw new Error("Gemini returned invalid JSON.");
  }

  return normalizeBill(raw);
}
