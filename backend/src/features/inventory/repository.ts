import { query } from "../../db/pool.js";

export type InventorySessionRow = {
  id: number;
  name: string;
  inventory_date: string;
  status: string;
  started_by_user_id: number;
  started_at: string | null;
  completed_at: string | null;
  remark: string | null;
  created_at: string;
  updated_at: string;
  scanned_count?: string | number | null;
  anomaly_count?: string | number | null;
};

export type InventoryItemRow = {
  id: number;
  inventory_session_id: number;
  book_id: number;
  scanned_at: string;
  scanned_by_user_id: number;
  result: string;
  shelf_id_at_scan: number | null;
  remark: string | null;
  created_at: string;
  updated_at: string;
  title?: string;
  accession_code?: string;
  isbn?: string | null;
};

type CreateInventorySessionInput = {
  name: string;
  inventoryDate?: string;
  startedByUserId?: number;
  remark?: string | null;
};

type UpsertInventoryItemInput = {
  inventorySessionId: number;
  bookId: number;
  scannedByUserId?: number;
  result?: "found" | "wrong_shelf" | "damaged" | "missing_check";
  shelfIdAtScan?: number | null;
  remark?: string | null;
};

export async function listInventorySessions() {
  const result = await query<InventorySessionRow>(
    `SELECT
       s.*,
       COUNT(i.id) AS scanned_count,
       COUNT(*) FILTER (WHERE i.result <> 'found') AS anomaly_count
     FROM inventory_sessions s
     LEFT JOIN inventory_items i ON i.inventory_session_id = s.id
     GROUP BY s.id
     ORDER BY s.id DESC`,
  );

  return result.rows;
}

export async function getInventorySessionById(id: number) {
  const result = await query<InventorySessionRow>(
    `SELECT
       s.*,
       COUNT(i.id) AS scanned_count,
       COUNT(*) FILTER (WHERE i.result <> 'found') AS anomaly_count
     FROM inventory_sessions s
     LEFT JOIN inventory_items i ON i.inventory_session_id = s.id
     WHERE s.id = $1
     GROUP BY s.id`,
    [id],
  );

  return result.rows[0] ?? null;
}

export async function createInventorySession(input: CreateInventorySessionInput) {
  const result = await query<InventorySessionRow>(
    `INSERT INTO inventory_sessions (
       name,
       inventory_date,
       status,
       started_by_user_id,
       started_at,
       remark
     ) VALUES (
       $1,
       $2::date,
       'in_progress',
       $3,
       NOW(),
       $4
     )
     RETURNING *`,
    [
      input.name,
      input.inventoryDate ?? new Date().toISOString().slice(0, 10),
      input.startedByUserId ?? 1,
      input.remark ?? null,
    ],
  );

  return result.rows[0];
}

export async function listInventoryItemsBySession(sessionId: number) {
  const result = await query<InventoryItemRow>(
    `SELECT
       i.*,
       b.title,
       b.accession_code,
       b.isbn
     FROM inventory_items i
     JOIN books b ON b.id = i.book_id
     WHERE i.inventory_session_id = $1
     ORDER BY i.scanned_at DESC`,
    [sessionId],
  );

  return result.rows;
}

export async function upsertInventoryItem(input: UpsertInventoryItemInput) {
  const result = await query<InventoryItemRow>(
    `INSERT INTO inventory_items (
       inventory_session_id,
       book_id,
       scanned_by_user_id,
       result,
       shelf_id_at_scan,
       remark
     ) VALUES (
       $1, $2, $3, $4, $5, $6
     )
     ON CONFLICT (inventory_session_id, book_id)
     DO UPDATE SET
       scanned_at = NOW(),
       scanned_by_user_id = EXCLUDED.scanned_by_user_id,
       result = EXCLUDED.result,
       shelf_id_at_scan = EXCLUDED.shelf_id_at_scan,
       remark = EXCLUDED.remark,
       updated_at = NOW()
     RETURNING *`,
    [
      input.inventorySessionId,
      input.bookId,
      input.scannedByUserId ?? 1,
      input.result ?? "found",
      input.shelfIdAtScan ?? null,
      input.remark ?? null,
    ],
  );

  return result.rows[0];
}

export async function completeInventorySession(id: number, remark?: string | null) {
  const result = await query<InventorySessionRow>(
    `UPDATE inventory_sessions
     SET
       status = 'completed',
       completed_at = NOW(),
       remark = COALESCE($2, remark),
       updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, remark ?? null],
  );

  return result.rows[0] ?? null;
}

export async function listMissingBooksForSession(sessionId: number) {
  const result = await query<{
    id: number;
    title: string;
    accession_code: string;
    isbn: string | null;
  }>(
    `SELECT b.id, b.title, b.accession_code, b.isbn
     FROM books b
     WHERE NOT EXISTS (
       SELECT 1
       FROM inventory_items i
       WHERE i.inventory_session_id = $1
         AND i.book_id = b.id
     )
     ORDER BY b.id DESC`,
    [sessionId],
  );

  return result.rows;
}
