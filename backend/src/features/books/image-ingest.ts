import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { backendRoot } from "../../config/paths.js";
import { env } from "../../config/env.js";
import { HttpError } from "../../lib/errors.js";

const execFileAsync = promisify(execFile);

export type AiIngestResult = {
  material_type: string;
  title: string;
  subtitle: string;
  authors: string[];
  publisher: string;
  pub_year: string;
  isbn: string;
  issn: string;
  volume: string;
  issue: string;
  publish_date: string;
  language: string;
  confidence: number;
  notes: string;
};

async function runIngest(scriptPath: string, imagePaths: string[], model: string) {
  const args = [scriptPath, "--api-key", env.geminiApiKey, "--model", model, ...imagePaths];
  const { stdout } = await execFileAsync("python3", args, {
    timeout: env.aiIngestTimeoutMs,
    maxBuffer: 8 * 1024 * 1024,
  });
  return JSON.parse(stdout) as AiIngestResult;
}

export async function ingestBookFromImages(imagePaths: string[]) {
  if (!env.geminiApiKey) {
    throw new HttpError(400, "AI service is not configured (missing GEMINI_API_KEY)");
  }

  if (!imagePaths.length) {
    throw new HttpError(400, "No images uploaded");
  }

  const scriptPath = path.resolve(backendRoot, "..", "scripts", "ingest_by_image.py");

  try {
    try {
      return await runIngest(scriptPath, imagePaths, env.geminiModel);
    } catch (primaryError) {
      if (!env.geminiFallbackModel || env.geminiFallbackModel === env.geminiModel) {
        throw primaryError;
      }
      return await runIngest(scriptPath, imagePaths, env.geminiFallbackModel);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI ingest failed";
    throw new HttpError(502, `AI ingest failed: ${message}`);
  } finally {
    await Promise.all(imagePaths.map((filePath) => fs.unlink(filePath).catch(() => undefined)));
  }
}
