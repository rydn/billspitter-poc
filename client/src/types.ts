// Domain types for the client. Mirrors shared/types.ts (kept local so the Vite
// TypeScript project stays self-contained for this POC).

export interface LineItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Bill {
  merchant?: string;
  currency: string;
  items: LineItem[];
  subtotal: number;
  total: number;
}

export interface AnalyzeBillResponse {
  bill: Bill;
  provider: "local" | "gemini";
  model: string;
}

export interface Person {
  id: string;
  name: string;
}

/** Map of line item id -> ids of people sharing that item. */
export type Assignments = Record<string, string[]>;
