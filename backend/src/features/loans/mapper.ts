export type LoanDetailRow = {
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

export function mapLoan(row: LoanDetailRow) {
  return {
    id: row.id,
    bookId: row.book_id,
    memberId: row.member_id,
    loanDate: row.loan_date,
    dueDate: row.due_date,
    returnedAt: row.returned_at,
    status: row.status,
    loanByUserId: row.loan_by_user_id,
    returnByUserId: row.return_by_user_id,
    remark: row.remark,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    book: {
      id: row.book_id,
      title: row.book_title,
      accessionCode: row.book_accession_code,
    },
    member: {
      id: row.member_id,
      name: row.member_name,
      memberCode: row.member_code,
    },
  };
}
