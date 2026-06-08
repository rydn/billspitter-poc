// Currency symbols for the few currencies we expect; falls back to the code.
const SYMBOLS: Record<string, string> = {
  ZAR: "R",
  USD: "$",
  EUR: "€",
  GBP: "£",
};

export function currencySymbol(code: string): string {
  return SYMBOLS[code.toUpperCase()] ?? code.toUpperCase() + " ";
}

export function formatMoney(amount: number, currency: string): string {
  const value = (Math.round(amount * 100) / 100).toFixed(2);
  return `${currencySymbol(currency)}${value}`;
}
