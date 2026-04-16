import { z } from "zod";

export const createInventorySessionSchema = z.object({
  name: z.string().trim().min(1).max(100),
  inventoryDate: z.string().trim().min(1).max(20).optional(),
  startedByUserId: z.number().int().positive().optional(),
  remark: z.string().trim().optional().nullable(),
});

export const scanInventoryItemSchema = z.object({
  bookCode: z.string().trim().min(1).max(100),
  operatorUserId: z.number().int().positive().optional(),
  result: z.enum(["found", "wrong_shelf", "damaged", "missing_check"]).optional(),
  remark: z.string().trim().optional().nullable(),
});

export const completeInventorySessionSchema = z.object({
  remark: z.string().trim().optional().nullable(),
});
