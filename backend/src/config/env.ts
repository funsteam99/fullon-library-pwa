import "dotenv/config";

export const env = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? "",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
  corsOrigins: (process.env.CORS_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  geminiModel: process.env.GEMINI_MODEL ?? "gemma-4-31b-it",
  geminiFallbackModel: process.env.GEMINI_FALLBACK_MODEL ?? "gemini-3-flash-preview",
  aiIngestTimeoutMs: Number(process.env.AI_INGEST_TIMEOUT_MS ?? 120000),
};
