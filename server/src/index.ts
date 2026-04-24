import express from "express";
import cors from "cors";
import config from "./config.js";
import { authMiddleware, adminOnly } from "./middleware/auth.js";
import { initDb } from "./services/db.js";

import expensesRouter from "./routes/expenses.js";
import advancesRouter from "./routes/advances.js";
import categoriesRouter from "./routes/categories.js";
import transcribeRouter from "./routes/transcribe.js";
import parseRouter from "./routes/parse.js";
import commitRouter from "./routes/commit.js";
import uploadRouter from "./routes/upload.js";
import filesRouter from "./routes/files.js";
import attendanceRouter from "./routes/attendance.js";
import notesRouter from "./routes/notes.js";

const app = express();

// Global middleware
app.use(cors());
app.use(express.json());

// File proxy — no auth (served as img src, browser can't send headers)
app.use("/api/files", filesRouter);

// Auth middleware for all other /api routes
app.use("/api", authMiddleware);

// Role endpoint (available to any authenticated user)
app.get("/api/auth/role", (req, res) => {
  res.json({ role: req.userRole });
});

// Read-only routes (both admin and viewer)
app.use("/api/expenses", expensesRouter);
app.use("/api/advances", advancesRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/attendance", attendanceRouter);
app.use("/api/notes", notesRouter);

// Write-only routes (admin only)
app.use("/api/transcribe", adminOnly, transcribeRouter);
app.use("/api/parse", adminOnly, parseRouter);
app.use("/api/commit", adminOnly, commitRouter);
app.use("/api/upload", adminOnly, uploadRouter);

// Health check (no auth)
app.get("/", (_req, res) => {
  res.json({ status: "ok" });
});

// Initialize DB then start server
initDb()
  .then(() => {
    console.log("Database tables initialized");
    app.listen(config.PORT, () => {
      console.log(`Server running on port ${config.PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to initialize database:", err);
    process.exit(1);
  });

export default app;
