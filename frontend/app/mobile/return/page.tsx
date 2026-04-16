"use client";

import { useCallback, useState, useTransition } from "react";

import { BarcodeScanner } from "../../components/barcode-scanner";
import { apiRequest } from "../../lib/api";
import { getCurrentOperatorId } from "../../lib/auth";

type ReturnResponse = {
  item: {
    returnedAt: string | null;
    status: string;
    book: { title: string; accessionCode: string };
    member: { name: string; memberCode: string };
  };
};

export default function MobileReturnPage() {
  const [bookCode, setBookCode] = useState("B0001");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleBookDetected = useCallback((code: string) => {
    setBookCode(code);
    setError(null);
  }, []);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    startTransition(async () => {
      try {
        const payload = await apiRequest<ReturnResponse>("/api/loans/return", {
          method: "POST",
          body: JSON.stringify({
            bookCode,
            operatorUserId: getCurrentOperatorId(),
          }),
        });

        setMessage(
          `《${payload.item.book.title}》已完成歸還，讀者 ${payload.item.member.name}，處理時間 ${new Date(payload.item.returnedAt ?? Date.now()).toLocaleString("zh-TW")}`,
        );
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "還書失敗");
      }
    });
  }

  return (
    <section className="mobile-stack">
      <article className="hero-card compact">
        <p className="eyebrow">Return</p>
        <h2>手機還書</h2>
        <p>現場只要掃一本到位，掃描結果會直接帶入書籍條碼欄位。</p>
      </article>

      <BarcodeScanner
        label="掃書即可還"
        helperText="開啟相機後將書背條碼對準框線，系統會自動填入書籍條碼。"
        onDetected={handleBookDetected}
      />

      <form className="mobile-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>書籍條碼</span>
          <input
            value={bookCode}
            onChange={(event) => setBookCode(event.target.value)}
            placeholder="例如 B0001"
            autoCapitalize="characters"
          />
        </label>

        <button type="submit" className="primary-button" disabled={isPending}>
          {isPending ? "處理中..." : "確認還書"}
        </button>
      </form>

      {message ? <div className="feedback success">{message}</div> : null}
      {error ? <div className="feedback error">{error}</div> : null}
    </section>
  );
}
