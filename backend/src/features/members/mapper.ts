import type { MemberRow } from "./repository.js";

export function mapMember(row: MemberRow) {
  return {
    id: row.id,
    memberCode: row.member_code,
    name: row.name,
    phone: row.phone,
    email: row.email,
    unitName: row.unit_name,
    photoUrl: row.photo_url,
    status: row.status,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
