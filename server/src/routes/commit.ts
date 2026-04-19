import { Router, Request, Response } from "express";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { addExpense } from "../services/db.js";
import { uploadFile } from "../services/filen.js";

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

interface ExpenseRow {
  date: string;
  category: string;
  description: string;
  quantity: number | null;
  unit: string | null;
  rate: number | null;
  total: number;
}

interface CommitBody {
  rows: ExpenseRow[];
  assignments: Record<string, number[]>;
}

router.post(
  "/",
  upload.array("images"),
  async (req: Request, res: Response) => {
    try {
      const dataField = req.body.data;
      if (!dataField) {
        res.status(400).json({ error: "Missing 'data' field in body" });
        return;
      }

      const { rows, assignments } = JSON.parse(dataField) as CommitBody;

      if (!rows || !Array.isArray(rows)) {
        res.status(400).json({ error: "rows must be an array" });
        return;
      }

      const files = (req.files as Express.Multer.File[]) || [];

      // Upload all image files and collect their cloud paths
      const imagePaths: string[] = [];
      for (const file of files) {
        const date =
          rows[0]?.date || new Date().toISOString().slice(0, 10);
        const cloudPath = await uploadFile(
          file.buffer,
          file.originalname,
          date,
        );
        imagePaths.push(cloudPath);
      }

      const ids: string[] = [];

      for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
        const row = rows[rowIdx];
        const id = uuidv4();
        ids.push(id);

        const assignedImageIndices = assignments?.[String(rowIdx)] || [];
        const assignedPaths = assignedImageIndices
          .map((imgIdx: number) => imagePaths[imgIdx])
          .filter(Boolean);

        await addExpense({
          id,
          date: row.date || new Date().toISOString().slice(0, 10),
          category: row.category,
          description: row.description,
          quantity: row.quantity,
          unit: row.unit,
          rate: row.rate,
          total: row.total,
          image_urls: assignedPaths.join(", "),
        });
      }

      res.json({ success: true, ids });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: message });
    }
  },
);

export default router;
