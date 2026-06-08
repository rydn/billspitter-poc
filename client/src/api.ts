import type { AnalyzeBillResponse, Bill } from "./types";

/**
 * Upload a bill image to the backend and return the parsed Bill.
 * Throws an Error with a user-friendly message on failure.
 */
export async function analyzeBill(file: File): Promise<Bill> {
  const form = new FormData();
  form.append("image", file);

  let res: Response;
  try {
    res = await fetch("/api/analyze-bill", { method: "POST", body: form });
  } catch {
    throw new Error("Could not reach the server. Is the backend running?");
  }

  if (!res.ok) {
    let message = `Request failed (${res.status}).`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // keep default message
    }
    throw new Error(message);
  }

  const data = (await res.json()) as AnalyzeBillResponse;
  return data.bill;
}
