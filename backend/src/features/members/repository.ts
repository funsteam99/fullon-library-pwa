import { query } from "../../db/pool.js";

export type MemberRow = {
  id: number;
  member_code: string;
  name: string;
  phone: string | null;
  email: string | null;
  unit_name: string | null;
  photo_url: string | null;
  status: string;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type MemberLoanRow = {
  id: number;
  book_id: number;
  member_id: number;
  loan_date: string;
  due_date: string;
  returned_at: string | null;
  status: string;
  loan_by_user_id: number;
  return_by_user_id: number | null;
  remark: string | null;
  created_at: string;
  updated_at: string;
  book_title: string;
  book_accession_code: string;
  member_name: string;
  member_code: string;
};

type CreateMemberInput = {
  memberCode: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  unitName?: string | null;
  photoUrl?: string | null;
  status?: "active" | "inactive";
  note?: string | null;
};

type UpdateMemberInput = Partial<CreateMemberInput>;

export async function listMembers() {
  const result = await query<MemberRow>(
    `SELECT *
     FROM members
     ORDER BY id DESC`,
  );

  return result.rows;
}

export async function getMemberById(id: number) {
  const result = await query<MemberRow>(
    `SELECT *
     FROM members
     WHERE id = $1`,
    [id],
  );

  return result.rows[0] ?? null;
}

export async function getMemberByCode(code: string) {
  const result = await query<MemberRow>(
    `SELECT *
     FROM members
     WHERE member_code = $1`,
    [code],
  );

  return result.rows[0] ?? null;
}

export async function listActiveLoansByMemberId(memberId: number) {
  const result = await query<MemberLoanRow>(
    `SELECT
       l.*,
       b.title AS book_title,
       b.accession_code AS book_accession_code,
       m.name AS member_name,
       m.member_code
     FROM loans l
     INNER JOIN books b ON b.id = l.book_id
     INNER JOIN members m ON m.id = l.member_id
     WHERE l.member_id = $1
       AND l.returned_at IS NULL
     ORDER BY l.due_date ASC, l.id DESC`,
    [memberId],
  );

  return result.rows;
}

export async function createMember(input: CreateMemberInput) {
  const result = await query<MemberRow>(
    `INSERT INTO members (
      member_code,
      name,
      phone,
      email,
      unit_name,
      photo_url,
      status,
      note
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8
    )
    RETURNING *`,
    [
      input.memberCode,
      input.name,
      input.phone ?? null,
      input.email ?? null,
      input.unitName ?? null,
      input.photoUrl ?? null,
      input.status ?? "active",
      input.note ?? null,
    ],
  );

  return result.rows[0];
}

export async function updateMember(id: number, input: UpdateMemberInput) {
  const fields: string[] = [];
  const values: unknown[] = [];

  const entries: Array<[string, unknown]> = [
    ["member_code", input.memberCode],
    ["name", input.name],
    ["phone", input.phone],
    ["email", input.email],
    ["unit_name", input.unitName],
    ["photo_url", input.photoUrl],
    ["status", input.status],
    ["note", input.note],
  ];

  for (const [column, value] of entries) {
    if (value !== undefined) {
      fields.push(`${column} = $${fields.length + 1}`);
      values.push(value);
    }
  }

  values.push(id);

  const result = await query<MemberRow>(
    `UPDATE members
     SET ${fields.join(", ")},
         updated_at = NOW()
     WHERE id = $${values.length}
     RETURNING *`,
    values,
  );

  return result.rows[0] ?? null;
}
