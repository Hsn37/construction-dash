import { createClient } from "@libsql/client";
import { v4 as uuidv4 } from "uuid";
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
        paid_by TEXT DEFAULT 'سلیم صاحب',
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
    {
      sql: `CREATE TABLE IF NOT EXISTS attendance (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'present'
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      args: [],
    },
  ]);

  // Migrate: add paid_by column if the table already existed without it
  try {
    await db.execute({
      sql: `ALTER TABLE expenses ADD COLUMN paid_by TEXT DEFAULT 'سلیم صاحب'`,
      args: [],
    });
  } catch (_) {
    // Column already exists — ignore
  }
}

// --- Expenses ---

export async function getAllExpenses() {
  const result = await db.execute("SELECT * FROM expenses ORDER BY date DESC, created_at DESC");
  return result.rows;
}

export async function deleteExpense(id: string) {
  await db.execute({ sql: "DELETE FROM expenses WHERE id = ?", args: [id] });
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
  paid_by: string;
}) {
  await db.execute({
    sql: `INSERT INTO expenses (id, date, category, description, quantity, unit, rate, total, image_urls, paid_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      data.paid_by,
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

// --- Attendance ---

export async function getAttendance() {
  const result = await db.execute("SELECT * FROM attendance ORDER BY date DESC");
  return result.rows;
}

export async function setAttendance(
  date: string,
  status: "present" | "cleared" | null,
) {
  if (status === null) {
    await db.execute({
      sql: "DELETE FROM attendance WHERE date = ?",
      args: [date],
    });
  } else {
    const id = uuidv4();
    await db.execute({
      sql: `INSERT INTO attendance (id, date, status) VALUES (?, ?, ?)
            ON CONFLICT(date) DO UPDATE SET status = excluded.status`,
      args: [id, date, status],
    });
  }
}

export async function bulkClearAttendance(dates: string[]) {
  if (dates.length === 0) return;
  const statements = dates.map((date) => ({
    sql: `INSERT INTO attendance (id, date, status) VALUES (?, ?, 'cleared')
          ON CONFLICT(date) DO UPDATE SET status = 'cleared'`,
    args: [uuidv4(), date],
  }));
  await db.batch(statements);
}

// --- Notes ---

export async function getAllNotes() {
  const result = await db.execute("SELECT * FROM notes ORDER BY created_at DESC");
  return result.rows;
}

export async function addNote(id: string, content: string) {
  await db.execute({
    sql: "INSERT INTO notes (id, content) VALUES (?, ?)",
    args: [id, content],
  });
}

export async function deleteNote(id: string) {
  await db.execute({ sql: "DELETE FROM notes WHERE id = ?", args: [id] });
}

// --- Settings ---

export async function getSetting(key: string) {
  const result = await db.execute({
    sql: "SELECT value FROM settings WHERE key = ?",
    args: [key],
  });
  return result.rows.length > 0 ? (result.rows[0].value as string) : null;
}

export async function setSetting(key: string, value: string) {
  await db.execute({
    sql: `INSERT INTO settings (key, value) VALUES (?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    args: [key, value],
  });
}

export default db;
