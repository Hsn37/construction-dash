import { Router, Request, Response } from "express";
import multer from "multer";
import { uploadFile } from "../services/filen.js";

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

router.post(
  "/",
  upload.single("image"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No image file provided" });
        return;
      }

      const date = new Date().toISOString().slice(0, 10);
      const url = await uploadFile(
        req.file.buffer,
        req.file.originalname,
        date,
      );

      res.json({ url });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: message });
    }
  },
);

export default router;
