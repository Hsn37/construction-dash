import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { addExpense } from "../services/db.js";

const router = Router();

interface ExpenseRow {
  date: string;
  category: string;
  description: string;
  quantity: number | null;
  unit: string | null;
  rate: number | null;
  total: number;
  image_urls: string;
}

router.post("/", async (req: Request, res: Response) => {
  try {
    // Frontend sends JSON body with { rows } or FormData with 'rows' field
    let rows: ExpenseRow[];

    if (req.body.rows && typeof req.body.rows === "string") {
      rows = JSON.parse(req.body.rows);
    } else if (req.body.rows && Array.isArray(req.body.rows)) {
      rows = req.body.rows;
    } else if (req.body.data) {
      const parsed = JSON.parse(req.body.data);
      rows = parsed.rows;
    } else {
      res.status(400).json({ error: "Missing 'rows' in body" });
      return;
    }

    if (!Array.isArray(rows)) {
      res.status(400).json({ error: "rows must be an array" });
      return;
    }

    const ids: string[] = [];

    for (const row of rows) {
      const id = uuidv4();
      ids.push(id);

      await addExpense({
        id,
        date: row.date || new Date().toISOString().slice(0, 10),
        category: row.category,
        description: row.description,
        quantity: row.quantity,
        unit: row.unit,
        rate: row.rate,
        total: row.total,
        image_urls: row.image_urls || "",
      });
    }

    res.json({ success: true, ids });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

export default router;
