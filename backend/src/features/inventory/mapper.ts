export function mapInventorySession(row: {
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
  scanned_count?: number | string | null;
  anomaly_count?: number | string | null;
}) {
  return {
    id: Number(row.id),
    name: row.name,
    inventoryDate: row.inventory_date,
    status: row.status,
    startedByUserId: Number(row.started_by_user_id),
    startedAt: row.started_at,
    completedAt: row.completed_at,
    remark: row.remark,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    scannedCount: row.scanned_count === undefined || row.scanned_count === null ? 0 : Number(row.scanned_count),
    anomalyCount: row.anomaly_count === undefined || row.anomaly_count === null ? 0 : Number(row.anomaly_count),
  };
}

export function mapInventoryItem(row: {
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
}) {
  return {
    id: Number(row.id),
    inventorySessionId: Number(row.inventory_session_id),
    bookId: Number(row.book_id),
    scannedAt: row.scanned_at,
    scannedByUserId: Number(row.scanned_by_user_id),
    result: row.result,
    shelfIdAtScan: row.shelf_id_at_scan === null ? null : Number(row.shelf_id_at_scan),
    remark: row.remark,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    title: row.title,
    accessionCode: row.accession_code,
    isbn: row.isbn,
  };
}
