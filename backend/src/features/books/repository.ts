import { query } from "../../db/pool.js";

export type BookRow = {
  id: number;
  isbn: string | null;
  accession_code: string;
  title: string;
  author: string | null;
  publisher: string | null;
  publish_year: number | null;
  category_id: number | null;
  shelf_id: number | null;
  cover_url: string | null;
  status: string;
  condition_note: string | null;
  source: string | null;
  price: string | null;
  remark: string | null;
  created_at: string;
  updated_at: string;
};

type CreateBookInput = {
  isbn?: string | null;
  accessionCode: string;
  title: string;
  author?: string | null;
  publisher?: string | null;
  publishYear?: number | null;
  categoryId?: number | null;
  shelfId?: number | null;
  coverUrl?: string | null;
  status?: "available" | "loaned" | "lost" | "repair" | "inventory" | "inactive";
  conditionNote?: string | null;
  source?: string | null;
  price?: number | null;
  remark?: string | null;
};

type UpdateBookInput = Partial<CreateBookInput>;

export async function listBooks() {
  const result = await query<BookRow>(
    `SELECT *
     FROM books
     ORDER BY id DESC`,
  );

  return result.rows;
}

export async function getBookById(id: number) {
  const result = await query<BookRow>(
    `SELECT *
     FROM books
     WHERE id = $1`,
    [id],
  );

  return result.rows[0] ?? null;
}

export async function getBookByBarcode(code: string) {
  const result = await query<BookRow>(
    `SELECT *
     FROM books
     WHERE accession_code = $1
        OR isbn = $1
     ORDER BY accession_code = $1 DESC
     LIMIT 1`,
    [code],
  );

  return result.rows[0] ?? null;
}

export async function getBookByAccessionCode(accessionCode: string) {
  const result = await query<BookRow>(
    `SELECT *
     FROM books
     WHERE accession_code = $1
     LIMIT 1`,
    [accessionCode],
  );

  return result.rows[0] ?? null;
}

export async function listBooksByIsbn(isbn: string) {
  const result = await query<BookRow>(
    `SELECT *
     FROM books
     WHERE isbn = $1
     ORDER BY id DESC`,
    [isbn],
  );

  return result.rows;
}

export async function createBook(input: CreateBookInput) {
  const result = await query<BookRow>(
    `INSERT INTO books (
      isbn,
      accession_code,
      title,
      author,
      publisher,
      publish_year,
      category_id,
      shelf_id,
      cover_url,
      status,
      condition_note,
      source,
      price,
      remark
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
    )
    RETURNING *`,
    [
      input.isbn ?? null,
      input.accessionCode,
      input.title,
      input.author ?? null,
      input.publisher ?? null,
      input.publishYear ?? null,
      input.categoryId ?? null,
      input.shelfId ?? null,
      input.coverUrl ?? null,
      input.status ?? "available",
      input.conditionNote ?? null,
      input.source ?? null,
      input.price ?? null,
      input.remark ?? null,
    ],
  );

  return result.rows[0];
}

export async function updateBook(id: number, input: UpdateBookInput) {
  const fields: string[] = [];
  const values: unknown[] = [];

  const entries: Array<[string, unknown]> = [
    ["isbn", input.isbn],
    ["accession_code", input.accessionCode],
    ["title", input.title],
    ["author", input.author],
    ["publisher", input.publisher],
    ["publish_year", input.publishYear],
    ["category_id", input.categoryId],
    ["shelf_id", input.shelfId],
    ["cover_url", input.coverUrl],
    ["status", input.status],
    ["condition_note", input.conditionNote],
    ["source", input.source],
    ["price", input.price],
    ["remark", input.remark],
  ];

  for (const [column, value] of entries) {
    if (value !== undefined) {
      fields.push(`${column} = $${fields.length + 1}`);
      values.push(value);
    }
  }

  values.push(id);

  const result = await query<BookRow>(
    `UPDATE books
     SET ${fields.join(", ")},
         updated_at = NOW()
     WHERE id = $${values.length}
     RETURNING *`,
    values,
  );

  return result.rows[0] ?? null;
}
