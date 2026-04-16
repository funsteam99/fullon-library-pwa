import { z } from "zod";

export const createMemberSchema = z.object({
  memberCode: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(100),
  phone: z.string().trim().max(50).optional().nullable(),
  email: z.string().trim().email().max(120).optional().nullable(),
  unitName: z.string().trim().max(120).optional().nullable(),
  photoUrl: z.string().trim().max(255).optional().nullable(),
  status: z.enum(["active", "inactive"]).optional(),
  note: z.string().trim().optional().nullable(),
});

export const updateMemberSchema = createMemberSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one field is required",
);
