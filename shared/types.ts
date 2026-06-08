// Shared domain types used by both the server and the client.

/** A single line item extracted from a bill. */
export interface LineItem {
  /** Stable identifier assigned by the server after extraction. */
  id: string;
  /** Human-readable item name, e.g. "Margherita Pizza". */
  name: string;
  /** Quantity ordered. Defaults to 1 when not present on the bill. */
  quantity: number;
  /** Price for a single unit, in the bill's currency. */
  unitPrice: number;
  /** Total price for this line (usually quantity * unitPrice). */
  totalPrice: number;
}

/** A structured representation of a scanned bill. */
export interface Bill {
  /** Restaurant / merchant name, if detected. */
  merchant?: string;
  /** ISO-4217 currency code, e.g. "ZAR". Defaults to "ZAR" when undetected. */
  currency: string;
  /** Extracted line items. */
  items: LineItem[];
  /** Sum of all line item totals as printed on the bill, if available. */
  subtotal: number;
  /** Grand total as printed on the bill, if available. Tax is included in prices. */
  total: number;
}

/** Response shape for the analyze-bill endpoint. */
export interface AnalyzeBillResponse {
  bill: Bill;
  /** Which OCR provider produced the result: "local" or "gemini". */
  provider: "local" | "gemini";
  /** Provider/model label, e.g. "qwen3-vl:8b" or "gemini-2.5-flash". */
  model: string;
}

/** Error response shape for API failures. */
export interface ApiError {
  error: string;
}
