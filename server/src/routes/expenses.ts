import { Router, Request, Response } from "express";
import { getAll } from "../services/sheets.js";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  try {
    const rows = await getAll("expenses");
    res.json(rows);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

export default router;
