import { Router, Request, Response } from "express";
import multer from "multer";
import { transcribe } from "../services/whisper.js";

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

router.post(
  "/",
  upload.single("audio"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No audio file provided" });
        return;
      }

      const text = await transcribe(req.file.buffer, req.file.mimetype);
      res.json({ text });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: message });
    }
  },
);

export default router;
