# Bill Splitter (POC)

Photograph a restaurant bill, extract the line items with Google Gemini, then
assign each item to one or more people and compute per-person totals (with tip).

This is a proof of concept for a feature in the wallet project.

## Structure

```
bill-splitter/
├── shared/        # Types shared by client and server (Bill, LineItem, ...)
├── server/        # Express + TypeScript API; calls Gemini for image analysis
└── client/        # Vite + React + TypeScript UI
```

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
Returns `{ bill: Bill }`.

> Security: the Gemini API key is only ever used server-side and is read from
> `server/.env`, which is gitignored. Rotate the key before any real deployment.
