import { Router } from "express";
import { ZodError, z } from "zod";

import {
  createUser,
  listActiveUsers,
  listUsers,
  updateUser,
} from "../features/users/repository.js";
import { asyncHandler } from "../lib/async-handler.js";
import { getCurrentUser, requireAdmin } from "../lib/auth.js";
import { HttpError } from "../lib/errors.js";
import { requireParam } from "../lib/params.js";
import { parseId } from "../lib/parse-int.js";

export const usersRouter = Router();

const createUserSchema = z.object({
  username: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(100),
  role: z.enum(["admin", "staff"]).default("staff"),
  status: z.enum(["active", "inactive"]).default("active"),
});

const updateUserSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  role: z.enum(["admin", "staff"]).optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

usersRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const rows = await listActiveUsers();

    res.json({
      items: rows.map((row) => ({
        id: row.id,
        username: row.username,
        name: row.name,
        role: row.role,
        status: row.status,
      })),
    });
  }),
);

usersRouter.get(
  "/manage",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const rows = await listUsers();
    res.json({ items: rows });
  }),
);

usersRouter.post(
  "/",
  requireAdmin,
  asyncHandler(async (req, res) => {
    try {
      const input = createUserSchema.parse(req.body);
      const row = await createUser(input);
      res.status(201).json({ item: row });
    } catch (error) {
      if (error instanceof ZodError) {
        throw new HttpError(400, error.issues[0]?.message ?? "Invalid request body");
      }

      throw error;
    }
  }),
);

usersRouter.patch(
  "/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    try {
      const id = parseId(requireParam(req.params.id, "id"));
      const input = updateUserSchema.parse(req.body);
      const currentUser = getCurrentUser(res);

      if (currentUser.id === id && input.status === "inactive") {
        throw new HttpError(400, "You cannot deactivate the current operator");
      }

      const row = await updateUser(id, input);

      if (!row) {
        throw new HttpError(404, "User not found");
      }

      res.json({ item: row });
    } catch (error) {
      if (error instanceof ZodError) {
        throw new HttpError(400, error.issues[0]?.message ?? "Invalid request body");
      }

      throw error;
    }
  }),
);
