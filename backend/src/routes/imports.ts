import { Router } from "express";
import multer from "multer";
import * as XLSX from "xlsx";

import { createBook, getBookByAccessionCode } from "../features/books/repository.js";
import { createMember, getMemberByCode } from "../features/members/repository.js";
import { asyncHandler } from "../lib/async-handler.js";
import { requireAdmin } from "../lib/auth.js";
import { HttpError } from "../lib/errors.js";

export const importsRouter = Router();
importsRouter.use(requireAdmin);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

type WorkbookRow = Record<string, unknown>;

function getWorkbookRows(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    throw new HttpError(400, "Workbook must contain at least one sheet");
  }

  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json<WorkbookRow>(sheet, {
    defval: "",
    raw: false,
  });
}

function getString(row: WorkbookRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function getOptionalString(row: WorkbookRow, keys: string[]) {
  const value = getString(row, keys);
  return value || null;
}

function getOptionalNumber(row: WorkbookRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value.trim());
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

function normalizeBookStatus(value: string | null) {
  if (!value) {
    return "available" as const;
  }

  const normalized = value.trim().toLowerCase();
  if (
    normalized === "available" ||
    normalized === "loaned" ||
    normalized === "lost" ||
    normalized === "repair" ||
    normalized === "inventory" ||
    normalized === "inactive"
  ) {
    return normalized;
  }

  return "available" as const;
}

function normalizeMemberStatus(value: string | null) {
  if (!value) {
    return "active" as const;
  }

  return value.trim().toLowerCase() === "inactive" ? "inactive" : "active";
}

importsRouter.post(
  "/books",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new HttpError(400, "File is required");
    }

    const rows = getWorkbookRows(req.file.buffer);
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const [index, row] of rows.entries()) {
      const line = index + 2;
      const accessionCode = getString(row, ["館藏條碼", "accessionCode", "AccessionCode"]);
      const title = getString(row, ["書名", "title", "Title"]);

      if (!accessionCode || !title) {
        skipped += 1;
        errors.push(`第 ${line} 列缺少必要欄位：館藏條碼或書名`);
        continue;
      }

      const existing = await getBookByAccessionCode(accessionCode);
      if (existing) {
        skipped += 1;
        errors.push(`第 ${line} 列館藏條碼重複：${accessionCode}`);
        continue;
      }

      await createBook({
        isbn: getOptionalString(row, ["ISBN", "isbn"]),
        accessionCode,
        title,
        author: getOptionalString(row, ["作者", "author", "Author"]),
        publisher: getOptionalString(row, ["出版社", "publisher", "Publisher"]),
        publishYear: getOptionalNumber(row, ["出版年", "publishYear", "PublishYear"]),
        status: normalizeBookStatus(getOptionalString(row, ["狀態", "status", "Status"])),
        remark: getOptionalString(row, ["備註", "remark", "Remark"]),
      });

      imported += 1;
    }

    res.status(201).json({
      item: {
        type: "books",
        totalRows: rows.length,
        imported,
        skipped,
        errors,
      },
    });
  }),
);

importsRouter.post(
  "/members",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new HttpError(400, "File is required");
    }

    const rows = getWorkbookRows(req.file.buffer);
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const [index, row] of rows.entries()) {
      const line = index + 2;
      const memberCode = getString(row, ["會員編號", "memberCode", "MemberCode"]);
      const name = getString(row, ["姓名", "name", "Name"]);

      if (!memberCode || !name) {
        skipped += 1;
        errors.push(`第 ${line} 列缺少必要欄位：會員編號或姓名`);
        continue;
      }

      const existing = await getMemberByCode(memberCode);
      if (existing) {
        skipped += 1;
        errors.push(`第 ${line} 列會員編號重複：${memberCode}`);
        continue;
      }

      await createMember({
        memberCode,
        name,
        phone: getOptionalString(row, ["電話", "phone", "Phone"]),
        email: getOptionalString(row, ["Email", "email"]),
        unitName: getOptionalString(row, ["單位", "unitName", "UnitName"]),
        status: normalizeMemberStatus(getOptionalString(row, ["狀態", "status", "Status"])),
        note: getOptionalString(row, ["備註", "note", "Note"]),
      });

      imported += 1;
    }

    res.status(201).json({
      item: {
        type: "members",
        totalRows: rows.length,
        imported,
        skipped,
        errors,
      },
    });
  }),
);
