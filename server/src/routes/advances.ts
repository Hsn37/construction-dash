import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { getAll, appendRow } from "../services/sheets.js";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  try {
    const rows = await getAll("advances");
    res.json(rows);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const { date, amount, note } = req.body as {
      date: string;
      amount: number;
      note?: string;
    };

    if (!date || amount === undefined) {
      res.status(400).json({ error: "date and amount are required" });
      return;
    }

    const id = uuidv4();

    await appendRow("advances", {
      id,
      date,
      amount,
      note: note || "",
    });

    res.json({ success: true, id });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

export default router;
