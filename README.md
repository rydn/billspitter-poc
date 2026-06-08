# Bill Splitter (POC)

Photograph a restaurant bill, extract the line items, then assign each item to
one or more people and compute per-person totals (with tip).

Line items are read by a **local vision model** (Ollama + `qwen3-vl`) for
highest accuracy and privacy, with automatic **fallback to Google Gemini**.

This is a proof of concept for a feature in the wallet project.

## Structure

```
bill-splitter/
├── shared/        # Types shared by client and server (Bill, LineItem, ...)
├── server/        # Express + TypeScript API; local OCR with Gemini fallback
│   └── src/
│       ├── bill.ts            # Shared prompt, JSON schema, normalization
│       ├── analyze.ts         # Provider selection + fallback
│       └── providers/
│           ├── ollama.ts      # Local vision model (qwen3-vl)
│           └── gemini.ts      # Cloud fallback
└── client/        # Vite + React + TypeScript UI
```

## OCR providers

The backend chooses a provider via `BILL_OCR_PROVIDER` in `server/.env`:

| Value    | Behaviour                                                        |
| -------- | --------------------------------------------------------------- |
| `auto`   | Try the local model first; fall back to Gemini on failure (default) |
| `local`  | Use the local Ollama vision model only                          |
| `gemini` | Use Gemini only                                                 |

### Local model (recommended for accuracy & privacy)

`qwen3-vl` is a state-of-the-art open vision-language model that reads the
receipt **and** returns structured line items in one pass. It runs locally via
[Ollama](https://ollama.com) and comfortably fits an Apple Silicon Mac with
≥16 GB RAM (the `8b` tag uses ~6 GB).

```bash
brew install --cask ollama-app   # official app (includes the model runner)
ollama serve &                    # start the local server (if not already running)
ollama pull qwen3-vl:8b           # download the model (~6 GB, one time)
```

> Note: use the `ollama-app` cask (or the installer from https://ollama.com).
> The plain `brew install ollama` formula currently ships without the
> `llama-server` runner and will fail to load models.

With Ollama running, `BILL_OCR_PROVIDER=auto` will use it automatically and only
reach for Gemini if the local model is unavailable or errors.

> Tip: on a 24 GB machine you can try a larger tag (e.g. `qwen3-vl:30b`) for
> even higher accuracy by setting `OLLAMA_MODEL` in `server/.env`.


## Money rules

- **Tax** is assumed to be already included in item prices (no separate tax line).
- Each item's cost is split **evenly** across the people assigned to it.
- **Tip** is entered in the UI (amount or %) and distributed **proportionally**
  to each person's assigned-item subtotal.
- **Currency** comes from Gemini's detection, defaulting to **ZAR (R)**.
- Items with no assignee are shown as an **unassigned remainder**.

## Prerequisites

- Node.js 18+ (uses the global `fetch`/`Blob` and modern tooling)
- A Google Gemini API key

## Setup

1. Install dependencies for both packages:

   ```bash
   cd server && npm install
   cd ../client && npm install
   ```

2. Configure the server's API key:

   ```bash
   cd server
   cp .env.example .env
   # edit .env and set GEMINI_API_KEY=...
   ```

## Running

In two terminals:

```bash
# Terminal 1 — backend on http://localhost:3001
cd server && npm run dev

# Terminal 2 — frontend on http://localhost:5173
cd client && npm run dev
```

Open the frontend URL, upload or photograph a bill, then assign items to people.

## API

`POST /api/analyze-bill` — multipart form with field `image` (the bill photo).
Returns `{ bill: Bill, provider: "local" | "gemini", model: string }`.

> Security: the Gemini API key is only ever used server-side and is read from
> `server/.env`, which is gitignored. Rotate the key before any real deployment.
