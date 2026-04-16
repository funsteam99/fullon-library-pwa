import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const backendRoot = path.resolve(__dirname, "..", "..");
export const uploadsRoot = path.join(backendRoot, "uploads");
export const bookCoversRoot = path.join(uploadsRoot, "books");
export const memberPhotosRoot = path.join(uploadsRoot, "members");
