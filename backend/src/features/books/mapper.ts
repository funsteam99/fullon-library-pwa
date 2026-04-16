import type { BookRow } from "./repository.js";

export function mapBook(row: BookRow) {
  return {
    id: row.id,
    isbn: row.isbn,
    accessionCode: row.accession_code,
    title: row.title,
    author: row.author,
    publisher: row.publisher,
    publishYear: row.publish_year,
    categoryId: row.category_id,
    shelfId: row.shelf_id,
    coverUrl: row.cover_url,
    status: row.status,
    conditionNote: row.condition_note,
    source: row.source,
    price: row.price === null ? null : Number(row.price),
    remark: row.remark,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
