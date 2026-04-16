import { z } from "zod";

export const createBookSchema = z.object({
  isbn: z.string().trim().max(30).optional().nullable(),
  accessionCode: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(255),
  author: z.string().trim().max(255).optional().nullable(),
  publisher: z.string().trim().max(255).optional().nullable(),
  publishYear: z.number().int().min(0).max(9999).optional().nullable(),
  categoryId: z.number().int().positive().optional().nullable(),
  shelfId: z.number().int().positive().optional().nullable(),
  coverUrl: z.string().trim().max(255).optional().nullable(),
  status: z.enum(["available", "loaned", "lost", "repair", "inventory", "inactive"]).optional(),
  conditionNote: z.string().trim().optional().nullable(),
  source: z.string().trim().max(50).optional().nullable(),
  price: z.number().nonnegative().optional().nullable(),
  remark: z.string().trim().optional().nullable(),
});

export const updateBookSchema = createBookSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one field is required",
);
