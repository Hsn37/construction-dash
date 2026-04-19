import FilenSDK from "@filen/sdk";
import path from "node:path";
import os from "node:os";
import config from "../config.js";

let filen: FilenSDK | null = null;
let loginPromise: Promise<void> | null = null;

async function getClient(): Promise<FilenSDK> {
  if (filen) return filen;

  if (loginPromise) {
    await loginPromise;
    return filen!;
  }

  filen = new FilenSDK({
    metadataCache: true,
    connectToSocket: false,
    tmpPath: path.join(os.tmpdir(), "filen-sdk"),
  });

  loginPromise = filen.login({
    email: config.FILEN_EMAIL,
    password: config.FILEN_PASSWORD,
  });

  await loginPromise;
  console.log("Filen SDK logged in");
  return filen;
}

/**
 * Ensure a date folder exists at /Construction/YYYY-MM-DD.
 * Creates intermediate directories as needed.
 */
export async function ensureFolder(date: string): Promise<string> {
  const client = await getClient();
  const folderPath = `/Construction/${date}`;
  await client.fs().mkdir({ path: folderPath });
  return folderPath;
}

/**
 * Upload a file buffer to a date folder in Filen.
 * Returns the cloud path (used to proxy-serve the file later).
 */
export async function uploadFile(
  buffer: Buffer,
  filename: string,
  date: string,
): Promise<string> {
  const client = await getClient();
  const folderPath = await ensureFolder(date);

  // Sanitize filename and add timestamp to avoid collisions
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const uniqueName = `${Date.now()}-${sanitized}`;
  const cloudPath = `${folderPath}/${uniqueName}`;

  await client.fs().writeFile({
    path: cloudPath,
    content: buffer,
  });

  return cloudPath;
}

/**
 * Read a file from Filen by its cloud path.
 * Returns the file contents as a Buffer.
 */
export async function readFile(cloudPath: string): Promise<Buffer> {
  const client = await getClient();
  return client.fs().readFile({ path: cloudPath });
}

/**
 * Check if a path exists in Filen.
 */
export async function exists(cloudPath: string): Promise<boolean> {
  const client = await getClient();
  try {
    await client.fs().stat({ path: cloudPath });
    return true;
  } catch {
    return false;
  }
}
