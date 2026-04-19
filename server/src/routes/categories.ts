import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import {
  getAll,
  appendRow,
  updateRow,
  findRowIndex,
} from "../services/sheets.js";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  try {
    const rows = await getAll("categories");
    const active = rows.filter((row) => row["active"] === "TRUE");
    res.json(active);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const { action, id, label } = req.body as {
      action: "add" | "update" | "delete";
      id?: string;
      label?: string;
    };

    if (!action) {
      res.status(400).json({ error: "action is required" });
      return;
    }

    switch (action) {
      case "add": {
        if (!label) {
          res.status(400).json({ error: "label is required for add" });
          return;
        }
        const newId = uuidv4();
        await appendRow("categories", {
          id: newId,
          label,
          active: "TRUE",
        });
        break;
      }

      case "update": {
        if (!id || !label) {
          res
            .status(400)
            .json({ error: "id and label are required for update" });
          return;
        }
        const updateIdx = await findRowIndex("categories", "id", id);
        if (updateIdx === -1) {
          res.status(404).json({ error: "Category not found" });
          return;
        }
        await updateRow("categories", updateIdx, {
          id,
          label,
          active: "TRUE",
        });
        break;
      }

      case "delete": {
        if (!id) {
          res.status(400).json({ error: "id is required for delete" });
          return;
        }
        const deleteIdx = await findRowIndex("categories", "id", id);
        if (deleteIdx === -1) {
          res.status(404).json({ error: "Category not found" });
          return;
        }
        // Read the existing row to preserve label
        const allRows = await getAll("categories");
        const existingRow = allRows[deleteIdx];
        await updateRow("categories", deleteIdx, {
          id,
          label: existingRow["label"] || "",
          active: "FALSE",
        });
        break;
      }

      default:
        res.status(400).json({ error: `Unknown action: ${action}` });
        return;
    }

    // Re-read and return the updated active categories
    const updatedRows = await getAll("categories");
    const active = updatedRows.filter((row) => row["active"] === "TRUE");
    res.json(active);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

export default router;
