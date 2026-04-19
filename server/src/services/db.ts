import { createClient } from "@libsql/client";
import config from "../config.js";

const db = createClient({
  url: config.TURSO_URL,
  authToken: config.TURSO_TOKEN,
});

/**
 * Initialize database tables. Called once on server startup.
 */
export async function initDb(): Promise<void> {
  await db.batch([
    {
      sql: `CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        quantity REAL,
        unit TEXT,
        rate REAL,
        total REAL NOT NULL,
        image_urls TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS advances (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        amount REAL NOT NULL,
        note TEXT NOT NULL DEFAULT ''
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1
      )`,
      args: [],
    },
  ]);
}

// --- Expenses ---

export async function getAllExpenses() {
  const result = await db.execute("SELECT * FROM expenses ORDER BY date DESC, created_at DESC");
  return result.rows;
}

export async function addExpense(data: {
  id: string;
  date: string;
  category: string;
  description: string;
  quantity: number | null;
  unit: string | null;
  rate: number | null;
  total: number;
  image_urls: string;
}) {
  await db.execute({
    sql: `INSERT INTO expenses (id, date, category, description, quantity, unit, rate, total, image_urls)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      data.id,
      data.date,
      data.category,
      data.description,
      data.quantity,
      data.unit,
      data.rate,
      data.total,
      data.image_urls,
    ],
  });
}

// --- Advances ---

export async function getAllAdvances() {
  const result = await db.execute("SELECT * FROM advances ORDER BY date DESC");
  return result.rows;
}

export async function addAdvance(data: {
  id: string;
  date: string;
  amount: number;
  note: string;
}) {
  await db.execute({
    sql: "INSERT INTO advances (id, date, amount, note) VALUES (?, ?, ?, ?)",
    args: [data.id, data.date, data.amount, data.note],
  });
}

// --- Categories ---

export async function getActiveCategories() {
  const result = await db.execute(
    "SELECT * FROM categories WHERE active = 1 ORDER BY label",
  );
  return result.rows;
}

export async function getAllCategories() {
  const result = await db.execute("SELECT * FROM categories ORDER BY active DESC, label");
  return result.rows;
}

export async function addCategory(id: string, label: string) {
  await db.execute({
    sql: "INSERT INTO categories (id, label, active) VALUES (?, ?, 1)",
    args: [id, label],
  });
}

export async function updateCategory(id: string, label: string) {
  await db.execute({
    sql: "UPDATE categories SET label = ? WHERE id = ?",
    args: [label, id],
  });
}

export async function setCategoryActive(id: string, active: boolean) {
  await db.execute({
    sql: "UPDATE categories SET active = ? WHERE id = ?",
    args: [active ? 1 : 0, id],
  });
}

export default db;
