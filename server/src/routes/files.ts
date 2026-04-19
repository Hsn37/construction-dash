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

// In-memory LRU cache: cloudPath → { buffer, timestamp }
const CACHE_MAX_ENTRIES = 200;
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const cache = new Map<string, { buffer: Buffer; timestamp: number }>();

function getCached(key: string): Buffer | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_MAX_AGE_MS) {
    cache.delete(key);
    return null;
  }
  // Move to end (most recently used)
  cache.delete(key);
  cache.set(key, entry);
  return entry.buffer;
}

function setCache(key: string, buffer: Buffer): void {
  // Evict oldest entries if at capacity
  while (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value!;
    cache.delete(oldest);
  }
  cache.set(key, { buffer, timestamp: Date.now() });
}

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

    // Check in-memory cache first
    let buffer = getCached(cloudPath);

    if (!buffer) {
      const fileExists = await exists(cloudPath);
      if (!fileExists) {
        res.status(404).json({ error: "File not found" });
        return;
      }
      buffer = await readFile(cloudPath);
      setCache(cloudPath, buffer);
    }

    const ext = path.extname(cloudPath).toLowerCase();
    const contentType = MIME_MAP[ext] || "image/jpeg";
    const etag = `"${cloudPath.length}-${buffer.length}"`;

    // Return 304 if browser already has this version
    if (req.headers["if-none-match"] === etag) {
      res.status(304).end();
      return;
    }

    res.set("Content-Type", contentType);
    res.set("Cache-Control", "public, max-age=86400, immutable");
    res.set("ETag", etag);
    res.send(buffer);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

export default router;
