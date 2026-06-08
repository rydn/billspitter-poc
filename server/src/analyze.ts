import type { Bill } from "../../shared/types.js";
import { analyzeWithGemini, isGeminiConfigured } from "./providers/gemini.js";
import {
  analyzeWithOllama,
  getOllamaModel,
  isOllamaAvailable,
} from "./providers/ollama.js";

export type OcrProvider = "local" | "gemini";
type ProviderPreference = "auto" | OcrProvider;

export interface AnalyzeResult {
  bill: Bill;
  /** Which provider actually produced the result. */
  provider: OcrProvider;
  /** Provider/model label for display, e.g. "qwen3-vl:8b" or "gemini-2.5-flash". */
  model: string;
  /** Wall-clock time the successful provider call took, in milliseconds. */
  durationMs: number;
}

function preference(): ProviderPreference {
  const raw = (process.env.BILL_OCR_PROVIDER ?? "auto").toLowerCase();
  if (raw === "local" || raw === "gemini") return raw;
  return "auto";
}

/** Format a millisecond duration as a short human-readable string. */
function formatDuration(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Run a single provider call with start/finish/timing logs.
 * Logs and re-throws on failure so callers can decide whether to fall back.
 */
async function runProvider(
  provider: OcrProvider,
  model: string,
  call: () => Promise<Bill>
): Promise<AnalyzeResult> {
  console.log(`[ocr] calling ${provider} model "${model}"…`);
  const start = performance.now();
  try {
    const bill = await call();
    const durationMs = performance.now() - start;
    console.log(
      `[ocr] ${provider} "${model}" succeeded in ${formatDuration(
        durationMs
      )} (${bill.items.length} items)`
    );
    return { bill, provider, model, durationMs };
  } catch (err) {
    const durationMs = performance.now() - start;
    const reason = err instanceof Error ? err.message : "unknown error";
    console.warn(
      `[ocr] ${provider} "${model}" failed after ${formatDuration(
        durationMs
      )}: ${reason}`
    );
    throw err;
  }
}

/**
 * Analyze a bill image, choosing the OCR provider based on BILL_OCR_PROVIDER:
 *  - "local":  local Ollama vision model only
 *  - "gemini": Gemini only
 *  - "auto" (default): try the local model first, fall back to Gemini on failure
 */
export async function analyzeBill(
  imageBuffer: Buffer,
  mimeType: string
): Promise<AnalyzeResult> {
  const pref = preference();

  if (pref === "gemini") {
    return runProvider("gemini", geminiModel(), () =>
      analyzeWithGemini(imageBuffer, mimeType)
    );
  }

  if (pref === "local") {
    return runProvider("local", getOllamaModel(), () =>
      analyzeWithOllama(imageBuffer, mimeType)
    );
  }

  // auto: prefer local, fall back to Gemini.
  const localReady = await isOllamaAvailable();
  if (localReady) {
    try {
      return await runProvider("local", getOllamaModel(), () =>
        analyzeWithOllama(imageBuffer, mimeType)
      );
    } catch {
      console.warn("[ocr] falling back to Gemini after local failure.");
    }
  } else {
    console.log("[ocr] local model unavailable; using Gemini.");
  }

  if (!isGeminiConfigured()) {
    throw new Error(
      localReady
        ? "Local OCR failed and Gemini is not configured as a fallback."
        : "Local OCR (Ollama) is not available and Gemini is not configured. Start Ollama with a vision model, or set GEMINI_API_KEY."
    );
  }

  return runProvider("gemini", geminiModel(), () =>
    analyzeWithGemini(imageBuffer, mimeType)
  );
}

function geminiModel(): string {
  return process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
}
