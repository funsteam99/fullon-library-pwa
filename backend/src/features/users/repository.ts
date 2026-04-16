import { query } from "../../db/pool.js";
import { HttpError } from "../../lib/errors.js";

export type UserRow = {
  id: number;
  username: string;
  name: string;
  role: "admin" | "staff";
  status: "active" | "inactive";
};

export async function getUserById(id: number) {
  const result = await query<UserRow>(
    `SELECT id::int AS id, username, name, role, status
     FROM users
     WHERE id = $1`,
    [id],
  );

  return result.rows[0] ?? null;
}

export async function listActiveUsers() {
  const result = await query<UserRow>(
    `SELECT id::int AS id, username, name, role, status
     FROM users
     WHERE status = 'active'
     ORDER BY
       CASE role WHEN 'admin' THEN 0 ELSE 1 END,
       name ASC,
       id ASC`,
  );

  return result.rows;
}

export async function listUsers() {
  const result = await query<UserRow>(
    `SELECT id::int AS id, username, name, role, status
     FROM users
     ORDER BY
       CASE role WHEN 'admin' THEN 0 ELSE 1 END,
       CASE status WHEN 'active' THEN 0 ELSE 1 END,
       name ASC,
       id ASC`,
  );

  return result.rows;
}

export async function createUser(input: {
  username: string;
  name: string;
  role: "admin" | "staff";
  status?: "active" | "inactive";
}) {
  try {
    const result = await query<UserRow>(
      `INSERT INTO users (username, password_hash, name, role, status)
       VALUES ($1, '', $2, $3, $4)
       RETURNING id::int AS id, username, name, role, status`,
      [input.username, input.name, input.role, input.status ?? "active"],
    );

    return result.rows[0];
  } catch (error) {
    if (error instanceof Error && "message" in error && String(error.message).includes("users_username_key")) {
      throw new HttpError(409, "Username already exists");
    }

    throw error;
  }
}

export async function updateUser(
  id: number,
  input: {
    name?: string;
    role?: "admin" | "staff";
    status?: "active" | "inactive";
  },
) {
  const current = await getUserById(id);

  if (!current) {
    return null;
  }

  const result = await query<UserRow>(
    `UPDATE users
     SET name = $2,
         role = $3,
         status = $4
     WHERE id = $1
     RETURNING id::int AS id, username, name, role, status`,
    [id, input.name ?? current.name, input.role ?? current.role, input.status ?? current.status],
  );

  return result.rows[0] ?? null;
}
