import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

interface Config {
  AUTH_SECRET: string;
  TURSO_URL: string;
  TURSO_TOKEN: string;
  FILEN_EMAIL: string;
  FILEN_PASSWORD: string;
  OPENAI_API_KEY: string;
  PORT: number;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const config: Config = {
  AUTH_SECRET: requireEnv("AUTH_SECRET"),
  TURSO_URL: requireEnv("TURSO_SQL_LITE_URL"),
  TURSO_TOKEN: requireEnv("TURSO_SQL_LITE_TOKEN"),
  FILEN_EMAIL: requireEnv("FILEN_EMAIL"),
  FILEN_PASSWORD: requireEnv("FILEN_PASSWORD"),
  OPENAI_API_KEY: requireEnv("OPENAI_API_KEY"),
  PORT: parseInt(process.env["PORT"] || "3001", 10),
};

export default config;
