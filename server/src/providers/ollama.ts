import type { Bill } from "../../../shared/types.js";
import { PROMPT, billJsonSchema, normalizeBill, parseBillJson } from "../bill.js";

const HOST = (process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434").replace(
  /\/+$/,
  ""
);
const MODEL = process.env.OLLAMA_MODEL ?? "qwen3-vl:8b";
// Vision models can be slow on first load; allow a generous timeout.
const TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS ?? 120_000);
// Context window (tokens). A receipt image alone can exceed the 4096 default,
// so use a larger window. Override with OLLAMA_NUM_CTX if needed.
const NUM_CTX = Number(process.env.OLLAMA_NUM_CTX ?? 16_384);

export function getOllamaModel(): string {
  return MODEL;
}

interface OllamaChatResponse {
  message?: { content?: string };
  error?: string;
}

/** True if the Ollama server is reachable and the configured model is pulled. */
export async function isOllamaAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${HOST}/api/tags`, {
      signal: AbortSignal.timeout(2_000),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { models?: Array<{ name?: string }> };
    const names = (data.models ?? []).map((m) => m.name ?? "");
    // Match exact tag or the base name (e.g. "qwen3-vl:8b" vs "qwen3-vl").
    const base = MODEL.split(":")[0];
    return names.some((n) => n === MODEL || n.split(":")[0] === base);
  } catch {
    return false;
  }
}

/**
 * Send a bill image to a local Ollama vision model and return a structured Bill.
 * Uses constrained JSON output via the `format` field for reliable parsing.
 */
export async function analyzeWithOllama(
  imageBuffer: Buffer,
  _mimeType: string
): Promise<Bill> {
  let res: Response;
  try {
    res = await fetch(`${HOST}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({
        model: MODEL,
        stream: false,
        format: billJsonSchema,
        options: { temperature: 0, num_ctx: NUM_CTX },
        messages: [
          {
            role: "user",
            content: PROMPT,
            images: [imageBuffer.toString("base64")],
          },
        ],
      }),
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : "unknown error";
    throw new Error(`Could not reach local Ollama at ${HOST} (${reason}).`);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Ollama request failed (${res.status}). ${body}`.trim()
    );
  }

  const data = (await res.json()) as OllamaChatResponse;
  if (data.error) {
    throw new Error(`Ollama error: ${data.error}`);
  }
  const content = data.message?.content;
  if (!content) {
    throw new Error("Ollama returned an empty response.");
  }

  try {
    return normalizeBill(parseBillJson(content));
  } catch {
    throw new Error("Ollama returned invalid JSON.");
  }
}
