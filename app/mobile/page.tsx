"use client";

import Link from "next/link";

import { getStoredOperator, isAdminOperator } from "../lib/auth";

const quickActions = [
  {
    href: "/mobile/loan",
    title: "借書",
    subtitle: "掃會員與書籍條碼，快速完成借出。",
  },
  {
    href: "/mobile/return",
    title: "還書",
    subtitle: "掃書籍條碼，立即完成歸還與逾期判斷。",
  },
  {
    href: "/mobile/books",
    title: "書籍清單",
    subtitle: "查詢、建立與編輯館藏書籍資料。",
  },
  {
    href: "/mobile/members",
    title: "會員清單",
    subtitle: "查詢、建立與編輯會員資料。",
  },
  {
    href: "/mobile/loans",
    title: "借閱紀錄",
    subtitle: "查看借出中、逾期中與歷史借閱紀錄。",
  },
  {
    href: "/mobile/exports",
    title: "Excel 匯出",
    subtitle: "下載書籍、會員與借閱資料。",
    adminOnly: true,
  },
  {
    href: "/mobile/imports",
    title: "Excel 匯入",
    subtitle: "用 Excel 批次建立書籍或會員資料。",
    adminOnly: true,
  },
  {
    href: "/mobile/inventory",
    title: "盤點",
    subtitle: "建立盤點批次、掃描館藏並輸出差異表。",
  },
  {
    href: "/mobile/operators",
    title: "操作者管理",
    subtitle: "新增、查看與停用 admin / staff。",
    adminOnly: true,
  },
];

const noticeItems = [
  {
    level: "warning",
    title: "今日優先處理",
    body: "先查看逾期借閱與未掃到清單，通常這兩塊最容易累積待辦。",
    href: "/mobile/loans",
    linkLabel: "查看借閱紀錄",
  },
  {
    level: "info",
    title: "建檔提醒",
    body: "若 ISBN 只帶出部分資料，記得補出版社、出版年與館藏條碼再送出。",
    href: "/mobile/books/new",
    linkLabel: "前往書籍建檔",
  },
  {
    level: "success",
    title: "盤點建議",
    body: "盤點完成後，記得匯出 Summary / Anomalies / MissingBooks 報表留存。",
    href: "/mobile/inventory",
    linkLabel: "前往盤點",
  },
];

export default function MobileHomePage() {
  const isAdmin = isAdminOperator();
  const operator = getStoredOperator();
  const visibleActions = quickActions.filter((action) => !action.adminOnly || isAdmin);
  const roleNotice = isAdmin
    ? {
        badge: "管理員消息",
        title: "今天可先檢查匯入匯出與備份",
        body: "你目前是 admin，可進行 Excel 匯入匯出、盤點完成與借閱修正等高權限操作。",
      }
    : {
        badge: "館員消息",
        title: "今天以借還、建檔與盤點掃描為主",
        body: "你目前是 staff，系統會自動隱藏或限制高權限功能，避免誤操作資料。",
      };

  return (
    <section className="mobile-stack">
      <article className="hero-card">
        <p className="eyebrow">Today's focus</p>
        <h2>手機就能處理建檔、借還與盤點</h2>
        <p>
          這個入口整合了書籍建檔、會員管理、借還書、盤點與 Excel 資料交換。
          目前操作者是 <strong>{operator.name}</strong>，首頁下方會同步顯示本日消息與處理提醒。
        </p>
      </article>

      <section className="notice-board">
        <article className="notice-hero">
          <div className="notice-badge">{roleNotice.badge}</div>
          <h3>{roleNotice.title}</h3>
          <p>{roleNotice.body}</p>
        </article>

        <div className="notice-list">
          {noticeItems.map((notice) => (
            <article key={notice.title} className={`notice-card notice-${notice.level}`}>
              <div className="notice-card-top">
                <span className="notice-dot" />
                <strong>{notice.title}</strong>
              </div>
              <p>{notice.body}</p>
              <Link href={notice.href} className="inline-link">
                {notice.linkLabel}
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="action-grid">
        {visibleActions.map((action) => (
          <Link key={action.href} href={action.href} className="action-card">
            <div className="action-badge">常用功能</div>
            <h3>{action.title}</h3>
            <p>{action.subtitle}</p>
          </Link>
        ))}
      </section>

      <section className="status-panel">
        <div>
          <p className="eyebrow">借書測試</p>
          <strong>會員 `M0001`</strong>
          <p>可先用測試會員確認借書流程是否正常。</p>
        </div>
        <div>
          <p className="eyebrow">還書測試</p>
          <strong>館藏 `B0001`</strong>
          <p>可先用測試館藏確認還書與狀態更新。</p>
        </div>
      </section>
    </section>
  );
}
