import { z } from "zod";

export const checkoutSchema = z.object({
  memberCode: z.string().trim().min(1).max(100),
  bookCode: z.string().trim().min(1).max(100),
  operatorUserId: z.number().int().positive(),
  dueDate: z.string().datetime().optional(),
  loanDays: z.number().int().positive().max(365).optional(),
  remark: z.string().trim().optional().nullable(),
});

export const returnSchema = z.object({
  bookCode: z.string().trim().min(1).max(100),
  operatorUserId: z.number().int().positive(),
  remark: z.string().trim().optional().nullable(),
});

export const forceReturnSchema = z.object({
  remark: z.string().trim().optional().nullable(),
});
