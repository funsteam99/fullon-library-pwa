"use client";

import Link from "next/link";
import { type ChangeEvent, useState, useTransition } from "react";

import { getOperatorRequestHeaders, isAdminOperator } from "../../lib/auth";

type ImportSummary = {
  item: {
    type: string;
    totalRows: number;
    imported: number;
    skipped: number;
    errors: string[];
  };
};

export default function MobileImportsPage() {
  const canImport = isAdminOperator();
  const [bookFile, setBookFile] = useState<File | null>(null);
  const [memberFile, setMemberFile] = useState<File | null>(null);
  const [bookResult, setBookResult] = useState<ImportSummary["item"] | null>(null);
  const [memberResult, setMemberResult] = useState<ImportSummary["item"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleFileChange(event: ChangeEvent<HTMLInputElement>, type: "books" | "members") {
    const file = event.target.files?.[0] ?? null;

    if (type === "books") {
      setBookFile(file);
      setBookResult(null);
    } else {
      setMemberFile(file);
      setMemberResult(null);
    }

    setError(null);
  }

  function uploadImport(type: "books" | "members") {
    const file = type === "books" ? bookFile : memberFile;

    if (!file) {
      setError(type === "books" ? "請先選擇書籍 Excel 檔案。" : "請先選擇會員 Excel 檔案。");
      return;
    }

    if (!canImport) {
      setError("Excel 匯入需要管理員權限。");
      return;
    }

    setError(null);

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch(`/api/imports/${type}`, {
          method: "POST",
          body: formData,
          headers: getOperatorRequestHeaders(),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { message?: string } | null;
          throw new Error(payload?.message ?? "匯入失敗");
        }

        const payload = (await response.json()) as ImportSummary;

        if (type === "books") {
          setBookResult(payload.item);
        } else {
          setMemberResult(payload.item);
        }
      } catch (importError) {
        setError(importError instanceof Error ? importError.message : "匯入失敗");
      }
    });
  }

  return (
    <section className="mobile-stack">
      <article className="hero-card compact">
        <p className="eyebrow">Imports</p>
        <h2>Excel 匯入</h2>
        <p>把既有的書籍或會員 Excel 檔案匯入系統，快速建立資料。</p>
      </article>

      <section className="action-grid">
        <Link href="/mobile/exports" className="action-card">
          <div className="action-badge">模板</div>
          <h3>先匯出再整理</h3>
          <p>可先下載目前資料當作欄位模板，再用同樣格式整理後匯入。</p>
        </Link>
      </section>

      {!canImport ? <div className="feedback">Excel 匯入需要管理員權限，館員角色無法上傳資料。</div> : null}

      <section className="mobile-form">
        <label className="field">
          <span>書籍 Excel</span>
          <input type="file" accept=".xlsx,.xls" onChange={(event) => handleFileChange(event, "books")} />
        </label>
        <button
          type="button"
          className="primary-button"
          onClick={() => uploadImport("books")}
          disabled={isPending || !canImport}
        >
          {isPending ? "匯入中..." : "匯入書籍"}
        </button>

        {bookResult ? (
          <div className="feedback success">
            <div>總列數：{bookResult.totalRows}</div>
            <div>成功匯入：{bookResult.imported}</div>
            <div>略過：{bookResult.skipped}</div>
            {bookResult.errors.length > 0 ? (
              <div className="feedback-meta">
                {bookResult.errors.slice(0, 10).map((message) => (
                  <div key={message}>{message}</div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="mobile-form">
        <label className="field">
          <span>會員 Excel</span>
          <input type="file" accept=".xlsx,.xls" onChange={(event) => handleFileChange(event, "members")} />
        </label>
        <button
          type="button"
          className="primary-button"
          onClick={() => uploadImport("members")}
          disabled={isPending || !canImport}
        >
          {isPending ? "匯入中..." : "匯入會員"}
        </button>

        {memberResult ? (
          <div className="feedback success">
            <div>總列數：{memberResult.totalRows}</div>
            <div>成功匯入：{memberResult.imported}</div>
            <div>略過：{memberResult.skipped}</div>
            {memberResult.errors.length > 0 ? (
              <div className="feedback-meta">
                {memberResult.errors.slice(0, 10).map((message) => (
                  <div key={message}>{message}</div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      {error ? <div className="feedback error">{error}</div> : null}
    </section>
  );
}
