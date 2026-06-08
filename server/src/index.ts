import "dotenv/config";
import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import multer from "multer";
import { analyzeBill } from "./gemini.js";
import type { AnalyzeBillResponse, ApiError } from "../../shared/types.js";

const PORT = Number(process.env.PORT ?? 3001);
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image uploads are allowed."));
    }
  },
});

const app = express();
app.use(cors());

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.post(
  "/api/analyze-bill",
  upload.single("image"),
  async (req: Request, res: Response<AnalyzeBillResponse | ApiError>) => {
    if (!req.file) {
      res.status(400).json({ error: "No image uploaded (field 'image')." });
      return;
    }

    try {
      const bill = await analyzeBill(req.file.buffer, req.file.mimetype);
      res.json({ bill });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to analyze the bill.";
      console.error("analyze-bill failed:", message);
      // Surface configuration errors as 500; everything else as 502 (upstream).
      const status = message.includes("GEMINI_API_KEY") ? 500 : 502;
      res.status(status).json({ error: message });
    }
  }
);

// Multer / generic error handler (e.g. file too large, wrong type).
app.use(
  (err: unknown, _req: Request, res: Response<ApiError>, _next: NextFunction) => {
    const message = err instanceof Error ? err.message : "Unexpected error.";
    res.status(400).json({ error: message });
  }
);

app.listen(PORT, () => {
  console.log(`Bill Splitter API listening on http://localhost:${PORT}`);
});
