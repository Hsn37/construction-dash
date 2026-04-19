import { google, sheets_v4 } from "googleapis";
import config from "../config.js";

const auth = new google.auth.JWT({
  email: config.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: config.GOOGLE_PRIVATE_KEY,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets: sheets_v4.Sheets = google.sheets({ version: "v4", auth });
const spreadsheetId = config.GOOGLE_SHEET_ID;

/**
 * Read all rows from a tab and return as an array of objects.
 * The first row is treated as headers.
 */
export async function getAll(
  tab: string,
): Promise<Record<string, string>[]> {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tab}!A:ZZ`,
  });

  const rows = response.data.values;
  if (!rows || rows.length < 2) {
    return [];
  }

  const headers = rows[0] as string[];
  return rows.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((header, i) => {
      obj[header] = row[i] !== undefined ? String(row[i]) : "";
    });
    return obj;
  });
}

/**
 * Append a single row to a tab. Keys in `data` must match the header names.
 * The row values are written in the same order as the existing headers.
 */
export async function appendRow(
  tab: string,
  data: Record<string, string | number | boolean>,
): Promise<void> {
  const headerResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tab}!1:1`,
  });

  const headers = headerResponse.data.values?.[0] as string[] | undefined;
  if (!headers) {
    throw new Error(`Tab "${tab}" has no header row`);
  }

  const rowValues = headers.map((header) => {
    const value = data[header];
    return value !== undefined ? value : "";
  });

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${tab}!A:A`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [rowValues],
    },
  });
}

/**
 * Update a specific row in a tab.
 * `rowIndex` is 0-based relative to data rows (i.e., row 0 is the first row after the header).
 */
export async function updateRow(
  tab: string,
  rowIndex: number,
  data: Record<string, string | number | boolean>,
): Promise<void> {
  const headerResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tab}!1:1`,
  });

  const headers = headerResponse.data.values?.[0] as string[] | undefined;
  if (!headers) {
    throw new Error(`Tab "${tab}" has no header row`);
  }

  const rowValues = headers.map((header) => {
    const value = data[header];
    return value !== undefined ? value : "";
  });

  // Sheet row = rowIndex + 2 (1 for 1-based indexing, 1 for header row)
  const sheetRow = rowIndex + 2;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${tab}!A${sheetRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [rowValues],
    },
  });
}

/**
 * Find the 0-based data row index where `column` matches `value`.
 * Returns -1 if not found.
 */
export async function findRowIndex(
  tab: string,
  column: string,
  value: string,
): Promise<number> {
  const allRows = await getAll(tab);

  for (let i = 0; i < allRows.length; i++) {
    if (allRows[i][column] === value) {
      return i;
    }
  }

  return -1;
}
