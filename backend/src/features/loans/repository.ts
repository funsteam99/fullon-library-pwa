import type { PoolClient, QueryResultRow } from "pg";

import { pool, query } from "../../db/pool.js";
import { HttpError } from "../../lib/errors.js";
import type { BookRow } from "../books/repository.js";
import type { MemberRow } from "../members/repository.js";
import type { LoanDetailRow } from "./mapper.js";

type UserRow = QueryResultRow & {
  id: number;
  status: string;
};

async function getUserById(client: PoolClient, id: number) {
  const result = await client.query<UserRow>(
    `SELECT id, status
     FROM users
     WHERE id = $1`,
    [id],
  );

  return result.rows[0] ?? null;
}

async function getMemberByCode(client: PoolClient, memberCode: string) {
  const result = await client.query<MemberRow>(
    `SELECT *
     FROM members
     WHERE member_code = $1`,
    [memberCode],
  );

  return result.rows[0] ?? null;
}

async function getBookByCode(client: PoolClient, bookCode: string) {
  const result = await client.query<BookRow>(
    `SELECT *
     FROM books
     WHERE accession_code = $1
        OR isbn = $1
     ORDER BY accession_code = $1 DESC
     LIMIT 1`,
    [bookCode],
  );

  return result.rows[0] ?? null;
}

async function getActiveLoanByBookId(client: PoolClient, bookId: number) {
  const result = await client.query<LoanDetailRow>(
    `SELECT
       l.*,
       b.title AS book_title,
       b.accession_code AS book_accession_code,
       m.name AS member_name,
       m.member_code
     FROM loans l
     INNER JOIN books b ON b.id = l.book_id
     INNER JOIN members m ON m.id = l.member_id
     WHERE l.book_id = $1
       AND l.returned_at IS NULL
     LIMIT 1`,
    [bookId],
  );

  return result.rows[0] ?? null;
}

function computeDueDate(dueDate?: string, loanDays?: number) {
  if (dueDate) {
    return new Date(dueDate);
  }

  const result = new Date();
  result.setDate(result.getDate() + (loanDays ?? 14));
  return result;
}

export async function checkoutLoan(input: {
  memberCode: string;
  bookCode: string;
  operatorUserId: number;
  dueDate?: string;
  loanDays?: number;
  remark?: string | null;
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const operator = await getUserById(client, input.operatorUserId);
    if (!operator || operator.status !== "active") {
      throw new HttpError(400, "Operator user is invalid");
    }

    const member = await getMemberByCode(client, input.memberCode);
    if (!member) {
      throw new HttpError(404, "Member not found");
    }
    if (member.status !== "active") {
      throw new HttpError(400, "Member is inactive");
    }

    const book = await getBookByCode(client, input.bookCode);
    if (!book) {
      throw new HttpError(404, "Book not found");
    }
    if (book.status !== "available") {
      throw new HttpError(400, "Book is not available for checkout");
    }

    const activeLoan = await getActiveLoanByBookId(client, book.id);
    if (activeLoan) {
      throw new HttpError(400, "Book already has an active loan");
    }

    const dueDate = computeDueDate(input.dueDate, input.loanDays);

    const insertResult = await client.query<LoanDetailRow>(
      `INSERT INTO loans (
         book_id,
         member_id,
         loan_date,
         due_date,
         status,
         loan_by_user_id,
         remark
       ) VALUES ($1, $2, NOW(), $3, 'loaned', $4, $5)
       RETURNING
         id,
         book_id,
         member_id,
         loan_date,
         due_date,
         returned_at,
         status,
         loan_by_user_id,
         return_by_user_id,
         remark,
         created_at,
         updated_at,
         ''::text AS book_title,
         ''::text AS book_accession_code,
         ''::text AS member_name,
         ''::text AS member_code`,
      [book.id, member.id, dueDate.toISOString(), input.operatorUserId, input.remark ?? null],
    );

    await client.query(
      `UPDATE books
       SET status = 'loaned',
           updated_at = NOW()
       WHERE id = $1`,
      [book.id],
    );

    const detail = await getActiveLoanByBookId(client, book.id);
    if (!detail) {
      throw new HttpError(500, "Loan created but could not be loaded");
    }

    await client.query("COMMIT");
    return detail;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function returnLoan(input: {
  bookCode: string;
  operatorUserId: number;
  remark?: string | null;
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const operator = await getUserById(client, input.operatorUserId);
    if (!operator || operator.status !== "active") {
      throw new HttpError(400, "Operator user is invalid");
    }

    const book = await getBookByCode(client, input.bookCode);
    if (!book) {
      throw new HttpError(404, "Book not found");
    }

    const activeLoan = await getActiveLoanByBookId(client, book.id);
    if (!activeLoan) {
      throw new HttpError(400, "No active loan found for this book");
    }

    const isOverdue = new Date(activeLoan.due_date).getTime() < Date.now();
    const nextRemark = [activeLoan.remark, input.remark].filter(Boolean).join("\n") || null;

    const result = await client.query<LoanDetailRow>(
      `UPDATE loans
       SET returned_at = NOW(),
           status = $1,
           return_by_user_id = $2,
           remark = $3,
           updated_at = NOW()
       WHERE id = $4
       RETURNING
         id,
         book_id,
         member_id,
         loan_date,
         due_date,
         returned_at,
         status,
         loan_by_user_id,
         return_by_user_id,
         remark,
         created_at,
         updated_at,
         ''::text AS book_title,
         ''::text AS book_accession_code,
         ''::text AS member_name,
         ''::text AS member_code`,
      [isOverdue ? "overdue" : "returned", input.operatorUserId, nextRemark, activeLoan.id],
    );

    await client.query(
      `UPDATE books
       SET status = 'available',
           updated_at = NOW()
       WHERE id = $1`,
      [book.id],
    );

    const detailResult = await client.query<LoanDetailRow>(
      `SELECT
         l.*,
         b.title AS book_title,
         b.accession_code AS book_accession_code,
         m.name AS member_name,
         m.member_code
       FROM loans l
       INNER JOIN books b ON b.id = l.book_id
       INNER JOIN members m ON m.id = l.member_id
       WHERE l.id = $1`,
      [result.rows[0].id],
    );

    await client.query("COMMIT");
    return detailResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function forceReturnLoan(input: {
  loanId: number;
  operatorUserId: number;
  remark?: string | null;
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const operator = await getUserById(client, input.operatorUserId);
    if (!operator || operator.status !== "active") {
      throw new HttpError(400, "Operator user is invalid");
    }

    const loanResult = await client.query<LoanDetailRow>(
      `SELECT
         l.*,
         b.title AS book_title,
         b.accession_code AS book_accession_code,
         m.name AS member_name,
         m.member_code
       FROM loans l
       INNER JOIN books b ON b.id = l.book_id
       INNER JOIN members m ON m.id = l.member_id
       WHERE l.id = $1
       LIMIT 1`,
      [input.loanId],
    );

    const loan = loanResult.rows[0] ?? null;
    if (!loan) {
      throw new HttpError(404, "Loan not found");
    }

    if (loan.returned_at) {
      throw new HttpError(400, "Loan has already been returned");
    }

    const nextStatus = new Date(loan.due_date).getTime() < Date.now() ? "overdue" : "returned";
    const nextRemark =
      [loan.remark, input.remark, `[force-return by user ${input.operatorUserId}]`]
        .filter(Boolean)
        .join("\n") || null;

    await client.query(
      `UPDATE loans
       SET returned_at = NOW(),
           status = $1,
           return_by_user_id = $2,
           remark = $3,
           updated_at = NOW()
       WHERE id = $4`,
      [nextStatus, input.operatorUserId, nextRemark, loan.id],
    );

    await client.query(
      `UPDATE books
       SET status = 'available',
           updated_at = NOW()
       WHERE id = $1`,
      [loan.book_id],
    );

    const detailResult = await client.query<LoanDetailRow>(
      `SELECT
         l.*,
         b.title AS book_title,
         b.accession_code AS book_accession_code,
         m.name AS member_name,
         m.member_code
       FROM loans l
       INNER JOIN books b ON b.id = l.book_id
       INNER JOIN members m ON m.id = l.member_id
       WHERE l.id = $1`,
      [loan.id],
    );

    await client.query("COMMIT");
    return detailResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listLoans() {
  const result = await query<LoanDetailRow>(
    `SELECT
       l.*,
       b.title AS book_title,
       b.accession_code AS book_accession_code,
       m.name AS member_name,
       m.member_code
     FROM loans l
     INNER JOIN books b ON b.id = l.book_id
     INNER JOIN members m ON m.id = l.member_id
     ORDER BY l.id DESC`,
  );

  return result.rows;
}

export async function listOverdueLoans() {
  const result = await query<LoanDetailRow>(
    `SELECT
       l.*,
       b.title AS book_title,
       b.accession_code AS book_accession_code,
       m.name AS member_name,
       m.member_code
     FROM loans l
     INNER JOIN books b ON b.id = l.book_id
     INNER JOIN members m ON m.id = l.member_id
     WHERE l.returned_at IS NULL
       AND l.due_date < NOW()
     ORDER BY l.due_date ASC`,
  );

  return result.rows;
}
