import { HttpError } from "./errors.js";

export function requireParam(value: string | string[] | undefined, fieldName: string) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new HttpError(400, `Invalid ${fieldName}`);
  }

  return value;
}
