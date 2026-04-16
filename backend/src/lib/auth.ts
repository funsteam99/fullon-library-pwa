import type express from "express";

import { getUserById, type UserRow } from "../features/users/repository.js";
import { HttpError } from "./errors.js";

export type CurrentUser = Pick<UserRow, "id" | "username" | "name" | "role" | "status">;

export type AuthenticatedResponse = express.Response & {
  locals: {
    currentUser: CurrentUser;
  };
};

function parseRawUserId(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return parseRawUserId(value[0]);
  }

  const normalized = typeof value === "string" ? value.trim() : "";

  if (!normalized) {
    return 1;
  }

  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new HttpError(401, "Invalid user header");
  }

  return parsed;
}

export async function attachCurrentUser(
  req: express.Request,
  res: AuthenticatedResponse,
  next: express.NextFunction,
) {
  try {
    const queryUserId = typeof req.query.userId === "string" ? req.query.userId : undefined;
    const userId = parseRawUserId(req.header("x-user-id") ?? queryUserId);
    const user = await getUserById(userId);

    if (!user || user.status !== "active") {
      throw new HttpError(401, "User not found or inactive");
    }

    res.locals.currentUser = user;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(...roles: CurrentUser["role"][]) {
  return (_req: express.Request, res: AuthenticatedResponse, next: express.NextFunction) => {
    const currentUser = res.locals.currentUser;

    if (!currentUser) {
      next(new HttpError(401, "Authentication required"));
      return;
    }

    if (!roles.includes(currentUser.role)) {
      next(new HttpError(403, "You do not have permission to perform this action"));
      return;
    }

    next();
  };
}

export function requireAdmin(
  req: express.Request,
  res: AuthenticatedResponse,
  next: express.NextFunction,
) {
  return requireRole("admin")(req, res, next);
}

export function getCurrentUser(res: express.Response) {
  const currentUser = (res.locals as { currentUser?: CurrentUser }).currentUser;

  if (!currentUser) {
    throw new HttpError(401, "Authentication required");
  }

  return currentUser;
}
