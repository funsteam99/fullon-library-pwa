"use client";

import Link from "next/link";

import { getCurrentOperatorId, isAdminOperator } from "../../lib/auth";
import { getApiUrl } from "../../lib/api";

export default function MobileExportsPage() {
  const userId = getCurrentOperatorId();
  const canExport = isAdminOperator();
  const exportItems = [
    {
      href: getApiUrl(`/api/exports/books.xlsx?userId=${userId}`),
      title: "匯出書籍",
      subtitle: "下載館藏清單、ISBN、館藏條碼與狀態。",
    },
    {
      href: getApiUrl(`/api/exports/members.xlsx?userId=${userId}`),
      title: "匯出會員",
      subtitle: "下載會員編號、姓名、聯絡方式與狀態。",
    },
    {
      href: getApiUrl(`/api/exports/loans.xlsx?userId=${userId}`),
      title: "匯出借閱",
      subtitle: "下載借閱紀錄、到期日、歸還日與逾期資訊。",
    },
  ];

  return (
    <section className="mobile-stack">
      <article className="hero-card compact">
        <p className="eyebrow">Exports</p>
        <h2>Excel 匯出</h2>
        <p>把書籍、會員與借閱資料下載成 Excel，方便備份、整理或交付他人。</p>
      </article>

      {canExport ? (
        <section className="action-grid">
          {exportItems.map((item) => (
            <a key={item.href} href={item.href} className="action-card">
              <div className="action-badge">匯出</div>
              <h3>{item.title}</h3>
              <p>{item.subtitle}</p>
            </a>
          ))}
        </section>
      ) : (
        <div className="feedback">Excel 匯出需要管理員權限，館員角色無法下載資料。</div>
      )}

      <section className="mobile-form">
        <div className="field">
          <span>說明</span>
          <div>
            {canExport
              ? "建議先檢查目前操作者是否為 admin，再下載需要的報表。"
              : "若需要匯出，請先切換成 admin 或由管理員操作。"}
          </div>
        </div>
        <div className="inline-actions">
          <Link href="/mobile/books" className="ghost-button">
            查看書籍
          </Link>
          <Link href="/mobile" className="ghost-button">
            回首頁
          </Link>
        </div>
      </section>
    </section>
  );
}
