"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { apiRequest } from "../../lib/api";
import { isAdminOperator } from "../../lib/auth";

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
  member: {
    id: number;
    name: string;
    memberCode: string;
  };
};

type LoansResponse = {
  items: LoanItem[];
};

type LoanFilter = "all" | "active" | "overdue";

const filterOptions: Array<{ value: LoanFilter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "active", label: "借出中" },
  { value: "overdue", label: "逾期中" },
];

function formatDateTime(value: string | null) {
  if (!value) {
    return "尚未歸還";
  }

  return new Date(value).toLocaleString("zh-TW");
}

function computeOverdueDays(dueDate: string) {
  const diff = Date.now() - new Date(dueDate).getTime();
  if (diff <= 0) {
    return 0;
  }

  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getLoanStatusView(item: LoanItem, overdueIds: Set<number>) {
  const isActiveLoan = item.returnedAt === null;

  if (overdueIds.has(item.id) && isActiveLoan) {
    return {
      label: "逾期中",
      className: "status-pill status-pill-overdue",
    };
  }

  if (item.status === "returned") {
    return {
      label: "已歸還",
      className: "status-pill status-pill-returned",
    };
  }

  if (item.status === "overdue") {
    return {
      label: "逾期歸還",
      className: "status-pill status-pill-overdue-returned",
    };
  }

  return {
    label: "借出中",
    className: "status-pill status-pill-loaned",
  };
}

export default function MobileLoansPage() {
  const canManageLoans = isAdminOperator();
  const [items, setItems] = useState<LoanItem[]>([]);
  const [overdueIds, setOverdueIds] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<LoanFilter>("all");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function refreshLoans() {
    const [allLoans, overdueLoans] = await Promise.all([
      apiRequest<LoansResponse>("/api/loans"),
      apiRequest<LoansResponse>("/api/loans/overdue"),
    ]);

    setItems(allLoans.items);
    setOverdueIds(new Set(overdueLoans.items.map((item) => item.id)));
  }

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [allLoans, overdueLoans] = await Promise.all([
          apiRequest<LoansResponse>("/api/loans"),
          apiRequest<LoansResponse>("/api/loans/overdue"),
        ]);

        if (!active) {
          return;
        }

        setItems(allLoans.items);
        setOverdueIds(new Set(overdueLoans.items.map((item) => item.id)));
        setError(null);
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "讀取借閱紀錄失敗");
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
  }, []);

  async function handleForceReturn(item: LoanItem) {
    if (!canManageLoans || item.returnedAt !== null) {
      return;
    }

    const confirmed = window.confirm(`確定要強制歸還《${item.book.title}》嗎？`);
    if (!confirmed) {
      return;
    }

    try {
      setError(null);
      setMessage(null);
      await apiRequest(`/api/loans/${item.id}/force-return`, {
        method: "POST",
        body: JSON.stringify({
          remark: "Force return from loan records page",
        }),
      });
      await refreshLoans();
      setMessage(`已強制歸還《${item.book.title}》`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "借閱修正失敗");
    }
  }

  const summary = useMemo(() => {
    const activeLoans = items.filter((item) => item.returnedAt === null);
    const overdueLoans = items.filter((item) => overdueIds.has(item.id) && item.returnedAt === null);

    return {
      total: items.length,
      active: activeLoans.length,
      overdue: overdueLoans.length,
    };
  }, [items, overdueIds]);

  const filteredItems = useMemo(() => {
    const byStatus =
      filter === "active"
        ? items.filter((item) => item.returnedAt === null)
        : filter === "overdue"
          ? items.filter((item) => overdueIds.has(item.id) && item.returnedAt === null)
          : items;

    const normalized = keyword.trim().toLowerCase();

    if (!normalized) {
      return byStatus;
    }

    return byStatus.filter((item) =>
      [item.book.title, item.book.accessionCode, item.member.name, item.member.memberCode]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized)),
    );
  }, [filter, items, keyword, overdueIds]);

  return (
    <section className="mobile-stack">
      <article className="hero-card compact">
        <p className="eyebrow">Loan records</p>
        <h2>借閱紀錄</h2>
        <p>查看目前借出中、逾期中與已歸還的借閱資料；管理員可在這裡做保守版修正。</p>
      </article>

      <section className="status-panel">
        <div>
          <p className="eyebrow">全部紀錄</p>
          <strong>{summary.total}</strong>
          <p>累計借閱筆數</p>
        </div>
        <div>
          <p className="eyebrow">借出中</p>
          <strong>{summary.active}</strong>
          <p>尚未歸還的借閱</p>
        </div>
        <div>
          <p className="eyebrow">逾期中</p>
          <strong>{summary.overdue}</strong>
          <p>需要追蹤的借閱</p>
        </div>
        <div>
          <p className="eyebrow">快速入口</p>
          <Link href="/mobile/loan" className="inline-link">
            前往借書
          </Link>
          <p>也可從首頁進入還書流程</p>
        </div>
      </section>

      {canManageLoans ? (
        <div className="feedback">目前使用 admin，可在借出中的紀錄上使用「強制歸還」。</div>
      ) : null}

      <section className="mobile-form">
        <div className="field">
          <span>篩選狀態</span>
          <div className="segmented-control" role="tablist" aria-label="借閱紀錄篩選">
            {filterOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`segmented-button ${filter === option.value ? "active" : ""}`}
                onClick={() => setFilter(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <label className="field">
          <span>搜尋借閱</span>
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="輸入書名、館藏條碼、會員姓名或會員編號"
          />
        </label>
      </section>

      <section className="books-list">
        {loading ? <div className="feedback">讀取借閱紀錄中...</div> : null}
        {message ? <div className="feedback success">{message}</div> : null}
        {error ? <div className="feedback error">{error}</div> : null}

        {!loading && !error && filteredItems.length === 0 ? (
          <div className="feedback">
            {keyword
              ? "查無符合搜尋條件的借閱紀錄"
              : filter === "overdue"
                ? "目前沒有逾期中的借閱"
                : "目前沒有借閱紀錄"}
          </div>
        ) : null}

        {!loading && !error
          ? filteredItems.map((item) => {
              const overdueDays = overdueIds.has(item.id) ? computeOverdueDays(item.dueDate) : 0;
              const statusView = getLoanStatusView(item, overdueIds);

              return (
                <article key={item.id} className="book-row">
                  <div className="book-row-main">
                    <h3>{item.book.title}</h3>
                    <p>館藏條碼：{item.book.accessionCode}</p>
                    <p>
                      借閱會員：{item.member.name} / {item.member.memberCode}
                    </p>
                    <p>借出時間：{formatDateTime(item.loanDate)}</p>
                    <p>到期時間：{formatDateTime(item.dueDate)}</p>
                    <p>歸還時間：{formatDateTime(item.returnedAt)}</p>
                    {overdueDays > 0 && item.returnedAt === null ? <p>逾期天數：{overdueDays} 天</p> : null}
                  </div>

                  <div className="book-row-side">
                    <span className={statusView.className}>{statusView.label}</span>
                    {canManageLoans && item.returnedAt === null ? (
                      <button
                        type="button"
                        className="inline-link"
                        onClick={() => void handleForceReturn(item)}
                      >
                        強制歸還
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })
          : null}
      </section>
    </section>
  );
}
