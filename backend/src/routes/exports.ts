import { Router } from "express";
import * as XLSX from "xlsx";

import { listBooks } from "../features/books/repository.js";
import {
  getInventorySessionById,
  listInventoryItemsBySession,
  listMissingBooksForSession,
} from "../features/inventory/repository.js";
import { listLoans } from "../features/loans/repository.js";
import { listMembers } from "../features/members/repository.js";
import { asyncHandler } from "../lib/async-handler.js";
import { requireAdmin } from "../lib/auth.js";
import { HttpError } from "../lib/errors.js";
import { requireParam } from "../lib/params.js";
import { parseId } from "../lib/parse-int.js";

export const exportsRouter = Router();
exportsRouter.use(requireAdmin);

const inventoryResultLabels: Record<string, string> = {
  found: "在架",
  wrong_shelf: "錯櫃",
  damaged: "損壞",
  missing_check: "待查",
};

function sendWorkbook(
  res: {
    setHeader: (name: string, value: string) => void;
    type: (value: string) => void;
    send: (body: Buffer) => void;
  },
  filename: string,
  sheets: Array<{ name: string; rows: Record<string, unknown>[] }>,
) {
  const workbook = XLSX.utils.book_new();

  sheets.forEach((sheetData) => {
    const sheet = XLSX.utils.json_to_sheet(sheetData.rows);
    XLSX.utils.book_append_sheet(workbook, sheet, sheetData.name);
  });

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
  );
  res.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.send(buffer);
}

exportsRouter.get(
  "/books.xlsx",
  asyncHandler(async (_req, res) => {
    const rows = await listBooks();

    sendWorkbook(res, "books.xlsx", [
      {
        name: "Books",
        rows: rows.map((row) => ({
          ID: row.id,
          ISBN: row.isbn,
          館藏條碼: row.accession_code,
          書名: row.title,
          作者: row.author,
          出版社: row.publisher,
          出版年: row.publish_year,
          狀態: row.status,
          備註: row.remark,
          建立時間: row.created_at,
          更新時間: row.updated_at,
        })),
      },
    ]);
  }),
);

exportsRouter.get(
  "/members.xlsx",
  asyncHandler(async (_req, res) => {
    const rows = await listMembers();

    sendWorkbook(res, "members.xlsx", [
      {
        name: "Members",
        rows: rows.map((row) => ({
          ID: row.id,
          會員編號: row.member_code,
          姓名: row.name,
          電話: row.phone,
          Email: row.email,
          單位: row.unit_name,
          狀態: row.status,
          備註: row.note,
          建立時間: row.created_at,
          更新時間: row.updated_at,
        })),
      },
    ]);
  }),
);

exportsRouter.get(
  "/loans.xlsx",
  asyncHandler(async (_req, res) => {
    const rows = await listLoans();

    sendWorkbook(res, "loans.xlsx", [
      {
        name: "Loans",
        rows: rows.map((row) => ({
          ID: row.id,
          書名: row.book_title,
          館藏條碼: row.book_accession_code,
          會員姓名: row.member_name,
          會員編號: row.member_code,
          借出時間: row.loan_date,
          到期時間: row.due_date,
          歸還時間: row.returned_at,
          狀態: row.status,
          備註: row.remark,
        })),
      },
    ]);
  }),
);

exportsRouter.get(
  "/inventory/:id.xlsx",
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

    const summaryRows = [
      { 項目: "盤點批次", 值: session.name },
      { 項目: "盤點日期", 值: session.inventory_date },
      { 項目: "狀態", 值: session.status },
      { 項目: "開始時間", 值: session.started_at },
      { 項目: "完成時間", 值: session.completed_at },
      { 項目: "已掃描數量", 值: items.length },
      { 項目: "異常數量", 值: items.filter((row) => row.result !== "found").length },
      { 項目: "未掃到數量", 值: missingBooks.length },
      { 項目: "在架", 值: items.filter((row) => row.result === "found").length },
      { 項目: "錯櫃", 值: items.filter((row) => row.result === "wrong_shelf").length },
      { 項目: "損壞", 值: items.filter((row) => row.result === "damaged").length },
      { 項目: "待查", 值: items.filter((row) => row.result === "missing_check").length },
      { 項目: "備註", 值: session.remark },
    ];

    const scannedRows = items.map((row) => ({
      ID: row.id,
      書名: row.title,
      館藏條碼: row.accession_code,
      ISBN: row.isbn,
      盤點結果: inventoryResultLabels[row.result] ?? row.result,
      掃描時間: row.scanned_at,
      備註: row.remark,
    }));

    const anomalyRows = items
      .filter((row) => row.result !== "found")
      .map((row) => ({
        ID: row.id,
        書名: row.title,
        館藏條碼: row.accession_code,
        ISBN: row.isbn,
        異常類型: inventoryResultLabels[row.result] ?? row.result,
        掃描時間: row.scanned_at,
        備註: row.remark,
      }));

    const missingRows = missingBooks.map((row) => ({
      ID: row.id,
      書名: row.title,
      館藏條碼: row.accession_code,
      ISBN: row.isbn,
      結果: "未掃到",
    }));

    sendWorkbook(res, `inventory-session-${id}.xlsx`, [
      { name: "Summary", rows: summaryRows },
      { name: "ScannedItems", rows: scannedRows },
      { name: "Anomalies", rows: anomalyRows },
      { name: "MissingBooks", rows: missingRows },
    ]);
  }),
);
