"use client";

import { useCallback, useState, useTransition } from "react";

import { BarcodeScanner } from "../../components/barcode-scanner";
import { apiRequest } from "../../lib/api";
import { getCurrentOperatorId } from "../../lib/auth";

type LoanResponse = {
  item: {
    dueDate: string;
    status: string;
    book: { title: string; accessionCode: string };
    member: { name: string; memberCode: string };
  };
};

export default function MobileLoanPage() {
  const [memberCode, setMemberCode] = useState("M0001");
  const [bookCode, setBookCode] = useState("B0001");
  const [loanDays, setLoanDays] = useState("14");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleMemberDetected = useCallback((code: string) => {
    setMemberCode(code);
    setError(null);
  }, []);

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
        const payload = await apiRequest<LoanResponse>("/api/loans/checkout", {
          method: "POST",
          body: JSON.stringify({
            memberCode,
            bookCode,
            operatorUserId: getCurrentOperatorId(),
            loanDays: Number(loanDays || "14"),
          }),
        });

        setMessage(
          `${payload.item.member.name} 已借出《${payload.item.book.title}》，到期日 ${new Date(payload.item.dueDate).toLocaleString("zh-TW")}`,
        );
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "借書失敗");
      }
    });
  }

  return (
    <section className="mobile-stack">
      <article className="hero-card compact">
        <p className="eyebrow">Checkout</p>
        <h2>手機借書</h2>
        <p>先掃會員證，再掃書本條碼。掃到後會自動帶入欄位，你只要確認後送出。</p>
      </article>

      <BarcodeScanner
        label="先掃會員證"
        helperText="用手機後鏡頭掃會員條碼，掃到後會自動填入會員編號。"
        onDetected={handleMemberDetected}
      />

      <BarcodeScanner
        label="再掃書籍條碼"
        helperText="再掃一次館藏條碼或 ISBN，借書表單會自動更新。"
        onDetected={handleBookDetected}
      />

      <form className="mobile-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>會員編號</span>
          <input
            value={memberCode}
            onChange={(event) => setMemberCode(event.target.value)}
            placeholder="例如 M0001"
            autoCapitalize="characters"
          />
        </label>

        <label className="field">
          <span>書籍條碼</span>
          <input
            value={bookCode}
            onChange={(event) => setBookCode(event.target.value)}
            placeholder="例如 B0001"
            autoCapitalize="characters"
          />
        </label>

        <label className="field">
          <span>借閱天數</span>
          <input
            type="number"
            min="1"
            max="365"
            value={loanDays}
            onChange={(event) => setLoanDays(event.target.value)}
          />
        </label>

        <button type="submit" className="primary-button" disabled={isPending}>
          {isPending ? "處理中..." : "確認借書"}
        </button>
      </form>

      {message ? <div className="feedback success">{message}</div> : null}
      {error ? <div className="feedback error">{error}</div> : null}
    </section>
  );
}
