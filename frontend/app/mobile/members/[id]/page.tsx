"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { apiRequest, resolveAssetUrl } from "../../../lib/api";

type MemberDetail = {
  id: number;
  memberCode: string;
  name: string;
  phone: string | null;
  email: string | null;
  unitName: string | null;
  photoUrl: string | null;
  status: string;
  note: string | null;
};

type MemberResponse = {
  item: MemberDetail;
};

type LoanItem = {
  id: number;
  loanDate: string;
  dueDate: string;
  returnedAt: string | null;
  status: string;
  book: {
    id: number;
    title: string;
    accessionCode: string;
  };
};

type LoansResponse = {
  items: LoanItem[];
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("zh-TW");
}

function computeOverdueDays(dueDate: string) {
  const diff = Date.now() - new Date(dueDate).getTime();
  if (diff <= 0) {
    return 0;
  }

  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getLoanStatusView(overdueDays: number) {
  if (overdueDays > 0) {
    return {
      label: "逾期中",
      className: "status-pill status-pill-overdue",
    };
  }

  return {
    label: "借出中",
    className: "status-pill status-pill-loaned",
  };
}

export default function MobileMemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [member, setMember] = useState<MemberDetail | null>(null);
  const [activeLoans, setActiveLoans] = useState<LoanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [memberId, setMemberId] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const resolvedParams = await params;
        const id = Number(resolvedParams.id);

        if (!Number.isFinite(id)) {
          throw new Error("會員編號格式不正確。");
        }

        const [memberResponse, loansResponse] = await Promise.all([
          apiRequest<MemberResponse>(`/api/members/${id}`),
          apiRequest<LoansResponse>(`/api/members/${id}/loans`),
        ]);

        if (!active) {
          return;
        }

        setMemberId(id);
        setMember(memberResponse.item);
        setActiveLoans(loansResponse.items);
        setError(null);
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "讀取會員資料時發生錯誤。");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [params]);

  const overdueCount = useMemo(() => {
    return activeLoans.filter((loan) => computeOverdueDays(loan.dueDate) > 0).length;
  }, [activeLoans]);

  return (
    <section className="mobile-stack">
      <article className="hero-card compact">
        <p className="eyebrow">Member detail</p>
        <h2>會員詳情</h2>
        <p>查看會員基本資料，以及這位會員目前借閱中的所有書籍。</p>
      </article>

      {loading ? <div className="feedback">讀取會員資料中...</div> : null}
      {error ? <div className="feedback error">{error}</div> : null}

      {!loading && !error && member ? (
        <>
          <section className="status-panel">
            <div>
              <p className="eyebrow">會員</p>
              <strong>{member.name}</strong>
              <p>{member.memberCode}</p>
            </div>
            <div>
              <p className="eyebrow">目前借閱中</p>
              <strong>{activeLoans.length}</strong>
              <p>{overdueCount > 0 ? `其中 ${overdueCount} 本逾期中` : "目前沒有逾期書籍"}</p>
            </div>
          </section>

          <section className="mobile-form">
            {member.photoUrl ? (
              <div className="cover-preview-card">
                <img
                  src={resolveAssetUrl(member.photoUrl) ?? undefined}
                  alt={`${member.name} 照片`}
                  className="cover-preview-image"
                />
              </div>
            ) : null}

            <div className="field">
              <span>姓名</span>
              <div>{member.name}</div>
            </div>
            <div className="field">
              <span>會員編號</span>
              <div>{member.memberCode}</div>
            </div>
            <div className="field">
              <span>電話</span>
              <div>{member.phone ?? "未填寫"}</div>
            </div>
            <div className="field">
              <span>Email</span>
              <div>{member.email ?? "未填寫"}</div>
            </div>
            <div className="field">
              <span>班級 / 單位</span>
              <div>{member.unitName ?? "未填寫"}</div>
            </div>
            <div className="field">
              <span>狀態</span>
              <div>{member.status}</div>
            </div>
            <div className="field">
              <span>備註</span>
              <div>{member.note ?? "未填寫"}</div>
            </div>

            {memberId ? (
              <div className="inline-actions">
                <Link href={`/mobile/members/${memberId}/edit`} className="ghost-button">
                  編輯會員
                </Link>
                <Link href="/mobile/loan" className="ghost-button">
                  前往借書
                </Link>
              </div>
            ) : null}
          </section>

          <section className="books-list">
            <article className="hero-card compact">
              <p className="eyebrow">Active loans</p>
              <h2>目前借閱中</h2>
              <p>這裡只顯示尚未歸還的書。完整歷史仍可到借閱紀錄頁查看。</p>
            </article>

            {activeLoans.length === 0 ? (
              <div className="feedback">目前沒有借閱中的書籍。</div>
            ) : (
              activeLoans.map((loan) => {
                const overdueDays = computeOverdueDays(loan.dueDate);
                const statusView = getLoanStatusView(overdueDays);

                return (
                  <article key={loan.id} className="book-row">
                    <div className="book-row-main">
                      <h3>{loan.book.title}</h3>
                      <p>館藏條碼：{loan.book.accessionCode}</p>
                      <p>借出時間：{formatDateTime(loan.loanDate)}</p>
                      <p>到期時間：{formatDateTime(loan.dueDate)}</p>
                      {overdueDays > 0 ? <p>逾期天數：{overdueDays} 天</p> : null}
                    </div>
                    <div className="book-row-side">
                      <span className={statusView.className}>{statusView.label}</span>
                    </div>
                  </article>
                );
              })
            )}
          </section>
        </>
      ) : null}
    </section>
  );
}
