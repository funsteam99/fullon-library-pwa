import { HttpError } from "./errors.js";

export function parseId(value: string, fieldName = "id") {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new HttpError(400, `Invalid ${fieldName}`);
  }

  return parsed;
}
