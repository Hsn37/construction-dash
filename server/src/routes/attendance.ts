import { Router, Request, Response } from "express";
import {
  getAttendance,
  setAttendance,
  bulkClearAttendance,
  getSetting,
  setSetting,
} from "../services/db.js";
import { adminOnly } from "../middleware/auth.js";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  try {
    const [rows, dailyRate] = await Promise.all([
      getAttendance(),
      getSetting("daily_rate"),
    ]);
    res.json({ attendance: rows, daily_rate: dailyRate ?? "2700" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

router.post("/", adminOnly, async (req: Request, res: Response) => {
  try {
    const { date, status } = req.body;

    if (!date) {
      res.status(400).json({ error: "date is required" });
      return;
    }

    if (status !== "present" && status !== "cleared" && status !== null) {
      res.status(400).json({ error: "status must be 'present', 'cleared', or null" });
      return;
    }

    await setAttendance(date, status);
    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

router.post("/bulk-clear", adminOnly, async (req: Request, res: Response) => {
  try {
    const { dates } = req.body;

    if (!Array.isArray(dates)) {
      res.status(400).json({ error: "dates must be an array" });
      return;
    }

    await bulkClearAttendance(dates);
    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

router.post("/settings", adminOnly, async (req: Request, res: Response) => {
  try {
    const { daily_rate } = req.body;

    if (!daily_rate) {
      res.status(400).json({ error: "daily_rate is required" });
      return;
    }

    await setSetting("daily_rate", daily_rate);
    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

export default router;
