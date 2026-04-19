import "dotenv/config";

interface Config {
  AUTH_SECRET: string;
  GOOGLE_SERVICE_ACCOUNT_EMAIL: string;
  GOOGLE_PRIVATE_KEY: string;
  GOOGLE_SHEET_ID: string;
  FILEN_EMAIL: string;
  FILEN_PASSWORD: string;
  OPENAI_API_KEY: string;
  OPENROUTER_API_KEY: string;
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
  GOOGLE_SERVICE_ACCOUNT_EMAIL: requireEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
  GOOGLE_PRIVATE_KEY: requireEnv("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n"),
  GOOGLE_SHEET_ID: requireEnv("GOOGLE_SHEET_ID"),
  FILEN_EMAIL: requireEnv("FILEN_EMAIL"),
  FILEN_PASSWORD: requireEnv("FILEN_PASSWORD"),
  OPENAI_API_KEY: requireEnv("OPENAI_API_KEY"),
  OPENROUTER_API_KEY: requireEnv("OPENROUTER_API_KEY"),
  PORT: parseInt(process.env["PORT"] || "3001", 10),
};

export default config;
