import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import {
  getAllCategories,
  addCategory,
  updateCategory,
  setCategoryActive,
} from "../services/db.js";
import { adminOnly } from "../middleware/auth.js";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  try {
    const rows = await getAllCategories();
    res.json(rows);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

router.post("/", adminOnly, async (req: Request, res: Response) => {
  try {
    const { action, id, label } = req.body;

    switch (action) {
      case "add":
        if (!label) {
          res.status(400).json({ error: "label is required" });
          return;
        }
        await addCategory(uuidv4(), label);
        break;

      case "update":
        if (!id || !label) {
          res.status(400).json({ error: "id and label are required" });
          return;
        }
        await updateCategory(id, label);
        break;

      case "delete":
        if (!id) {
          res.status(400).json({ error: "id is required" });
          return;
        }
        await setCategoryActive(id, false);
        break;

      case "reactivate":
        if (!id) {
          res.status(400).json({ error: "id is required" });
          return;
        }
        await setCategoryActive(id, true);
        break;

      default:
        res.status(400).json({ error: "Invalid action" });
        return;
    }

    const updated = await getAllCategories();
    res.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

export default router;
