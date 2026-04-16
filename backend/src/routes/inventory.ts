import { Router } from "express";
import { ZodError } from "zod";

import { getBookByBarcode } from "../features/books/repository.js";
import { mapInventoryItem, mapInventorySession } from "../features/inventory/mapper.js";
import {
  completeInventorySession,
  createInventorySession,
  getInventorySessionById,
  listInventoryItemsBySession,
  listInventorySessions,
  listMissingBooksForSession,
  upsertInventoryItem,
} from "../features/inventory/repository.js";
import {
  completeInventorySessionSchema,
  createInventorySessionSchema,
  scanInventoryItemSchema,
} from "../features/inventory/schemas.js";
import { asyncHandler } from "../lib/async-handler.js";
import { getCurrentUser, requireAdmin } from "../lib/auth.js";
import { HttpError } from "../lib/errors.js";
import { requireParam } from "../lib/params.js";
import { parseId } from "../lib/parse-int.js";

export const inventoryRouter = Router();

inventoryRouter.get(
  "/sessions",
  asyncHandler(async (_req, res) => {
    const rows = await listInventorySessions();
    res.json({ items: rows.map(mapInventorySession) });
  }),
);

inventoryRouter.post(
  "/sessions",
  requireAdmin,
  asyncHandler(async (req, res) => {
    try {
      const input = createInventorySessionSchema.parse(req.body);
      const currentUser = getCurrentUser(res);
      const row = await createInventorySession({
        ...input,
        startedByUserId: currentUser.id,
      });
      res.status(201).json({ item: mapInventorySession(row) });
    } catch (error) {
      if (error instanceof ZodError) {
        throw new HttpError(400, error.issues[0]?.message ?? "Invalid request body");
      }

      throw error;
    }
  }),
);

inventoryRouter.get(
  "/sessions/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(requireParam(req.params.id, "id"));
    const session = await getInventorySessionById(id);

    if (!session) {
      throw new HttpError(404, "Inventory session not found");
    }

    const [items, missingBooks] = await Promise.all([
      listInventoryItemsBySession(id),
      listMissingBooksForSession(id),
    ]);

    res.json({
      item: {
        ...mapInventorySession(session),
        scannedItems: items.map(mapInventoryItem),
        missingBooks: missingBooks.map((book) => ({
          id: book.id,
          title: book.title,
          accessionCode: book.accession_code,
          isbn: book.isbn,
        })),
      },
    });
  }),
);

inventoryRouter.post(
  "/sessions/:id/scan",
  asyncHandler(async (req, res) => {
    const id = parseId(requireParam(req.params.id, "id"));
    const session = await getInventorySessionById(id);

    if (!session) {
      throw new HttpError(404, "Inventory session not found");
    }

    if (session.status === "completed") {
      throw new HttpError(400, "Inventory session already completed");
    }

    try {
      const input = scanInventoryItemSchema.parse(req.body);
      const currentUser = getCurrentUser(res);
      const book = await getBookByBarcode(input.bookCode);

      if (!book) {
        throw new HttpError(404, "Book not found");
      }

      const row = await upsertInventoryItem({
        inventorySessionId: id,
        bookId: book.id,
        scannedByUserId: currentUser.id,
        result: input.result ?? "found",
        shelfIdAtScan: book.shelf_id ?? null,
        remark: input.remark ?? null,
      });

      res.status(201).json({
        item: mapInventoryItem({
          ...row,
          title: book.title,
          accession_code: book.accession_code,
          isbn: book.isbn,
        }),
      });
    } catch (error) {
      if (error instanceof ZodError) {
        throw new HttpError(400, error.issues[0]?.message ?? "Invalid request body");
      }

      throw error;
    }
  }),
);

inventoryRouter.post(
  "/sessions/:id/complete",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = parseId(requireParam(req.params.id, "id"));

    try {
      const input = completeInventorySessionSchema.parse(req.body);
      const row = await completeInventorySession(id, input.remark ?? null);

      if (!row) {
        throw new HttpError(404, "Inventory session not found");
      }

      const missingBooks = await listMissingBooksForSession(id);

      res.json({
        item: {
          ...mapInventorySession(row),
          missingCount: missingBooks.length,
          missingBooks: missingBooks.map((book) => ({
            id: book.id,
            title: book.title,
            accessionCode: book.accession_code,
            isbn: book.isbn,
          })),
        },
      });
    } catch (error) {
      if (error instanceof ZodError) {
        throw new HttpError(400, error.issues[0]?.message ?? "Invalid request body");
      }

      throw error;
    }
  }),
);
