import { Router, Request, Response } from "express";
import { getAllExpenses, deleteExpense } from "../services/db.js";
import { adminOnly } from "../middleware/auth.js";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  try {
    const rows = await getAllExpenses();
    res.json(rows);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

router.delete("/:id", adminOnly, async (req: Request, res: Response) => {
  try {
    await deleteExpense(req.params.id as string);
    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

export default router;
