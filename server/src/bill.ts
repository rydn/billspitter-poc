import { randomUUID } from "node:crypto";
import type { Bill, LineItem } from "../../shared/types.js";

export const DEFAULT_CURRENCY = "ZAR";

/** Instruction shared by every OCR provider. */
export const PROMPT = [
  "You are a precise bill/receipt parser.",
  "Extract every individual line item from this restaurant bill image.",
  "Prices already include tax; do not add or remove tax.",
  "Do not include tip, tax, service charge, subtotal, or total rows as line items.",
  "If a quantity is not shown, use 1. Compute totalPrice as quantity * unitPrice when only a unit price is visible.",
  "Detect the currency code if possible; otherwise return an empty string.",
  "Respond with JSON only, matching the requested schema.",
].join(" ");

/**
 * Standard JSON Schema describing the expected model output. Used directly by
 * Ollama's `format` field and mirrored by the Gemini provider's typed schema.
 */
export const billJsonSchema = {
  type: "object",
  properties: {
    merchant: {
      type: "string",
      description: "Restaurant or merchant name, empty string if not visible.",
    },
    currency: {
      type: "string",
      description:
        "ISO-4217 currency code such as ZAR, USD, EUR. Empty string if unknown.",
    },
    items: {
      type: "array",
      description: "Every individual line item ordered on the bill.",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "Item name." },
          quantity: {
            type: "number",
            description: "Quantity ordered. Use 1 if not shown.",
          },
          unitPrice: { type: "number", description: "Price per single unit." },
          totalPrice: {
            type: "number",
            description: "Total price for this line (quantity * unitPrice).",
          },
        },
        required: ["name", "quantity", "unitPrice", "totalPrice"],
      },
    },
    subtotal: {
      type: "number",
      description: "Subtotal before tip. Use 0 if not shown.",
    },
    total: {
      type: "number",
      description: "Grand total as printed. Use 0 if not shown.",
    },
  },
  required: ["merchant", "currency", "items", "subtotal", "total"],
} as const;

/** Loosely-typed model output before normalization. */
export interface RawBill {
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

/** Map common currency symbols/words to ISO-4217 codes. */
const CURRENCY_ALIASES: Record<string, string> = {
  R: "ZAR",
  RAND: "ZAR",
  $: "USD",
  "€": "EUR",
  "£": "GBP",
  "¥": "JPY",
};

/** Normalize a detected currency value to an ISO-4217 code. */
function normalizeCurrency(value: string | undefined): string {
  const raw = (value ?? "").trim();
  if (!raw) return DEFAULT_CURRENCY;
  const upper = raw.toUpperCase();
  if (CURRENCY_ALIASES[upper]) return CURRENCY_ALIASES[upper];
  // Already a 3-letter ISO code.
  if (/^[A-Z]{3}$/.test(upper)) return upper;
  return DEFAULT_CURRENCY;
}


/** Normalize raw model output into a well-formed Bill with stable ids. */
export function normalizeBill(raw: RawBill): Bill {
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
    currency: normalizeCurrency(raw.currency),
    items,
    subtotal,
    total: toNumber(raw.total, 0) || subtotal,
  };
}

/** Parse a JSON string that may be wrapped in markdown code fences. */
export function parseBillJson(text: string): RawBill {
  const trimmed = text.trim();
  // Some models wrap JSON in ```json ... ``` fences; strip them if present.
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced ? fenced[1] : trimmed;
  return JSON.parse(candidate) as RawBill;
}
