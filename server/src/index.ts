import express from "express";
import cors from "cors";
import config from "./config.js";
import { authMiddleware } from "./middleware/auth.js";

import expensesRouter from "./routes/expenses.js";
import advancesRouter from "./routes/advances.js";
import categoriesRouter from "./routes/categories.js";
import transcribeRouter from "./routes/transcribe.js";
import parseRouter from "./routes/parse.js";
import commitRouter from "./routes/commit.js";
import uploadRouter from "./routes/upload.js";
import filesRouter from "./routes/files.js";

const app = express();

// Global middleware
app.use(cors());
app.use(express.json());

// Auth middleware for all /api routes
app.use("/api", authMiddleware);

// API routes
app.use("/api/expenses", expensesRouter);
app.use("/api/advances", advancesRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/transcribe", transcribeRouter);
app.use("/api/parse", parseRouter);
app.use("/api/commit", commitRouter);
app.use("/api/upload", uploadRouter);
app.use("/api/files", filesRouter);

// Health check (no auth)
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(config.PORT, () => {
  console.log(`Server running on port ${config.PORT}`);
});

export default app;
