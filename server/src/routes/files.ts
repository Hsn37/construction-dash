import { Router, Request, Response } from "express";
import { readFile, exists } from "../services/filen.js";
import path from "node:path";

const router = Router();

const MIME_MAP: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".heic": "image/heic",
};

/**
 * GET /api/files?path=/Construction/2026-04-18/receipt.jpg
 * Proxies a file from Filen storage to the client.
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const cloudPath = req.query.path as string;
    if (!cloudPath) {
      res.status(400).json({ error: "Missing 'path' query parameter" });
      return;
    }

    if (cloudPath.includes("..")) {
      res.status(400).json({ error: "Invalid path" });
      return;
    }

    const fileExists = await exists(cloudPath);
    if (!fileExists) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const buffer = await readFile(cloudPath);
    const ext = path.extname(cloudPath).toLowerCase();
    const contentType = MIME_MAP[ext] || "image/jpeg";

    res.set("Content-Type", contentType);
    res.set("Cache-Control", "public, max-age=86400");
    res.send(buffer);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

export default router;
