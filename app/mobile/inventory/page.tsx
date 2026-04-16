"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useState, useTransition } from "react";

import { BarcodeScanner } from "../../components/barcode-scanner";
import { apiRequest, getApiUrl } from "../../lib/api";
import { getCurrentOperatorId, isAdminOperator } from "../../lib/auth";

type InventoryResult = "found" | "wrong_shelf" | "damaged" | "missing_check";

type InventorySession = {
  id: number;
  name: string;
  inventoryDate: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  scannedCount: number;
  anomalyCount: number;
  remark?: string | null;
};

type InventoryItem = {
  id: number;
  title?: string;
  accessionCode?: string;
  isbn?: string | null;
  scannedAt: string;
  result: InventoryResult;
  remark?: string | null;
};

type MissingBook = {
  id: number;
  title: string;
  accessionCode: string;
  isbn: string | null;
};

type InventorySessionsResponse = {
  items: InventorySession[];
};

type InventorySessionDetailResponse = {
  item: InventorySession & {
    scannedItems: InventoryItem[];
    missingBooks: MissingBook[];
  };
};

const resultOptions: Array<{ value: InventoryResult; label: string; description: string }> = [
  { value: "found", label: "在架", description: "確認書籍在架上，屬於正常盤點結果。" },
  { value: "wrong_shelf", label: "錯櫃", description: "書有掃到，但位置不正確。" },
  { value: "damaged", label: "損壞", description: "盤點時發現書況異常。" },
  { value: "missing_check", label: "待查", description: "需要後續人工確認的異常。" },
];

const resultLabels: Record<InventoryResult, string> = {
  found: "在架",
  wrong_shelf: "錯櫃",
  damaged: "損壞",
  missing_check: "待查",
};

function getResultClassName(result: InventoryResult) {
  if (result === "found") {
    return "status-pill status-pill-returned";
  }

  if (result === "wrong_shelf") {
    return "status-pill status-pill-loaned";
  }

  return "status-pill status-pill-overdue";
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "尚未完成";
  }

  return new Date(value).toLocaleString("zh-TW");
}

export default function MobileInventoryPage() {
  const userId = getCurrentOperatorId();
  const canManageSessions = isAdminOperator();
  const [sessions, setSessions] = useState<InventorySession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [selectedSession, setSelectedSession] = useState<InventorySessionDetailResponse["item"] | null>(null);
  const [newSessionName, setNewSessionName] = useState("");
  const [bookCode, setBookCode] = useState("");
  const [scanResult, setScanResult] = useState<InventoryResult>("found");
  const [scanRemark, setScanRemark] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  async function loadSessions(targetSessionId?: number | null) {
    const data = await apiRequest<InventorySessionsResponse>("/api/inventory/sessions");
    setSessions(data.items);

    const nextSessionId = targetSessionId ?? selectedSessionId ?? data.items[0]?.id ?? null;
    setSelectedSessionId(nextSessionId);

    if (nextSessionId) {
      const detail = await apiRequest<InventorySessionDetailResponse>(`/api/inventory/sessions/${nextSessionId}`);
      setSelectedSession(detail.item);
    } else {
      setSelectedSession(null);
    }
  }

  useEffect(() => {
    let active = true;

    async function boot() {
      try {
        await loadSessions();
        if (active) {
          setError(null);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "讀取盤點資料失敗");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void boot();

    return () => {
      active = false;
    };
  }, []);

  function handleDetected(code: string) {
    setBookCode(code);
    setError(null);
  }

  function handleCreateSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    startTransition(async () => {
      try {
        const payload = await apiRequest<{ item: InventorySession }>("/api/inventory/sessions", {
          method: "POST",
          body: JSON.stringify({
            name: newSessionName || `盤點 ${new Date().toLocaleDateString("zh-TW")}`,
            startedByUserId: getCurrentOperatorId(),
          }),
        });

        setNewSessionName("");
        await loadSessions(payload.item.id);
        setMessage(`已建立盤點批次：${payload.item.name}`);
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "建立盤點批次失敗");
      }
    });
  }

  function handleScan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedSessionId || !bookCode.trim()) {
      setError("請先選擇盤點批次，並輸入或掃描館藏條碼。");
      return;
    }

    setMessage(null);
    setError(null);

    startTransition(async () => {
      try {
        const payload = await apiRequest<{
          item: { title?: string; accessionCode?: string; result: InventoryResult };
        }>(`/api/inventory/sessions/${selectedSessionId}/scan`, {
          method: "POST",
          body: JSON.stringify({
            bookCode,
            operatorUserId: getCurrentOperatorId(),
            result: scanResult,
            remark: scanRemark.trim() || null,
          }),
        });

        await loadSessions(selectedSessionId);
        setBookCode("");
        setScanRemark("");
        setMessage(
          `已記錄《${payload.item.title ?? "未命名書籍"}》 / ${payload.item.accessionCode ?? "無館藏條碼"} / ${
            resultLabels[payload.item.result]
          }`,
        );
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "盤點掃描失敗");
      }
    });
  }

  function handleCompleteSession() {
    if (!selectedSessionId) {
      setError("請先選擇盤點批次。");
      return;
    }

    setMessage(null);
    setError(null);

    startTransition(async () => {
      try {
        const payload = await apiRequest<{
          item: InventorySession & {
            missingCount: number;
            missingBooks: Array<{ title: string; accessionCode: string }>;
          };
        }>(`/api/inventory/sessions/${selectedSessionId}/complete`, {
          method: "POST",
          body: JSON.stringify({}),
        });

        await loadSessions(selectedSessionId);
        setMessage(`已完成盤點，未掃到 ${payload.item.missingCount} 本。`);
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "完成盤點失敗");
      }
    });
  }

  const summary = useMemo(() => {
    const scannedItems = selectedSession?.scannedItems ?? [];

    return {
      found: scannedItems.filter((item) => item.result === "found").length,
      wrongShelf: scannedItems.filter((item) => item.result === "wrong_shelf").length,
      damaged: scannedItems.filter((item) => item.result === "damaged").length,
      missingCheck: scannedItems.filter((item) => item.result === "missing_check").length,
      missingBooks: selectedSession?.missingBooks.length ?? 0,
      anomalies: scannedItems.filter((item) => item.result !== "found"),
    };
  }, [selectedSession]);

  return (
    <section className="mobile-stack">
      <article className="hero-card compact">
        <p className="eyebrow">Inventory</p>
        <h2>盤點</h2>
        <p>建立盤點批次、掃描館藏、記錄異常，並直接在手機上查看差異摘要與未掃到清單。</p>
      </article>

      <section className="action-grid compact">
        <Link href="/mobile/books" className="action-card">
          <div className="action-badge">書籍</div>
          <h3>查看書籍清單</h3>
          <p>盤點前可先確認館藏資料是否完整。</p>
        </Link>
        {selectedSessionId ? (
          <a href={getApiUrl(`/api/exports/inventory/${selectedSessionId}.xlsx?userId=${userId}`)} className="action-card">
            <div className="action-badge">報表</div>
            <h3>匯出盤點 Excel</h3>
            <p>下載摘要、已掃描、異常與未掃到清單。</p>
          </a>
        ) : null}
      </section>

      <form className="mobile-form" onSubmit={handleCreateSession}>
        <label className="field">
          <span>建立盤點批次</span>
          <input
            value={newSessionName}
            onChange={(event) => setNewSessionName(event.target.value)}
            placeholder="例如：2026 年春季盤點"
          />
        </label>
        <button type="submit" className="primary-button" disabled={isPending || !canManageSessions}>
          {isPending ? "建立中..." : "建立盤點批次"}
        </button>
        {!canManageSessions ? <small>只有 admin 可以建立或完成盤點批次。</small> : null}
      </form>

      <section className="mobile-form">
        <label className="field">
          <span>選擇盤點批次</span>
          <select
            value={selectedSessionId ?? ""}
            onChange={(event) => {
              const nextId = event.target.value ? Number(event.target.value) : null;
              setSelectedSessionId(nextId);
              if (nextId) {
                void loadSessions(nextId);
              } else {
                setSelectedSession(null);
              }
            }}
            className="field-select"
          >
            <option value="">請選擇</option>
            {sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.name} / {session.status}
              </option>
            ))}
          </select>
        </label>
      </section>

      <BarcodeScanner
        label="掃描盤點書籍"
        helperText="掃描館藏條碼或 ISBN，系統會依你選擇的盤點結果寫入本次批次。"
        onDetected={handleDetected}
      />

      <form className="mobile-form" onSubmit={handleScan}>
        <label className="field">
          <span>館藏條碼</span>
          <input
            value={bookCode}
            onChange={(event) => setBookCode(event.target.value)}
            placeholder="例如 B0001"
            autoCapitalize="characters"
          />
        </label>

        <div className="field">
          <span>盤點結果</span>
          <div className="segmented-control" role="tablist" aria-label="盤點結果">
            {resultOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`segmented-button ${scanResult === option.value ? "active" : ""}`}
                onClick={() => setScanResult(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <small>{resultOptions.find((option) => option.value === scanResult)?.description}</small>
        </div>

        <label className="field">
          <span>備註</span>
          <textarea
            value={scanRemark}
            onChange={(event) => setScanRemark(event.target.value)}
            placeholder="例如：封面破損、放錯櫃、待人工複查"
            rows={3}
          />
        </label>

        <button type="submit" className="primary-button" disabled={isPending || !selectedSessionId}>
          {isPending ? "記錄中..." : "記錄盤點結果"}
        </button>
      </form>

      {selectedSession ? (
        <section className="mobile-stack">
          <section className="status-panel">
            <div>
              <p className="eyebrow">盤點批次</p>
              <strong>{selectedSession.name}</strong>
              <p>{selectedSession.status}</p>
            </div>
            <div>
              <p className="eyebrow">已掃描</p>
              <strong>{selectedSession.scannedCount}</strong>
              <p>異常 {selectedSession.anomalyCount} 本</p>
            </div>
            <div>
              <p className="eyebrow">未掃到</p>
              <strong>{summary.missingBooks}</strong>
              <p>完成盤點後列入差異表</p>
            </div>
            <div>
              <p className="eyebrow">完成時間</p>
              <strong>{formatDateTime(selectedSession.completedAt)}</strong>
              <p>開始：{formatDateTime(selectedSession.startedAt)}</p>
            </div>
          </section>

          <section className="status-panel">
            <div>
              <p className="eyebrow">在架</p>
              <strong>{summary.found}</strong>
              <p>正常掃描</p>
            </div>
            <div>
              <p className="eyebrow">錯櫃</p>
              <strong>{summary.wrongShelf}</strong>
              <p>位置異常</p>
            </div>
            <div>
              <p className="eyebrow">損壞</p>
              <strong>{summary.damaged}</strong>
              <p>需處理書況</p>
            </div>
            <div>
              <p className="eyebrow">待查</p>
              <strong>{summary.missingCheck}</strong>
              <p>待人工複核</p>
            </div>
          </section>

          <button
            type="button"
            className="ghost-button"
            onClick={handleCompleteSession}
            disabled={isPending || selectedSession.status === "completed" || !canManageSessions}
          >
            {selectedSession.status === "completed" ? "本批次已完成" : "完成本次盤點"}
          </button>

          <section className="books-list">
            <article className="hero-card compact">
              <p className="eyebrow">Anomalies</p>
              <h2>異常清單</h2>
              <p>把錯櫃、損壞與待查的館藏集中列出，方便後續處理。</p>
            </article>

            {summary.anomalies.length === 0 ? (
              <div className="feedback success">目前沒有異常項目。</div>
            ) : (
              summary.anomalies.map((item) => (
                <article key={item.id} className="book-row">
                  <div className="book-row-main">
                    <h3>{item.title ?? "未命名書籍"}</h3>
                    <p>館藏條碼：{item.accessionCode ?? "無"}</p>
                    <p>ISBN：{item.isbn ?? "無"}</p>
                    <p>掃描時間：{formatDateTime(item.scannedAt)}</p>
                    {item.remark ? <p>備註：{item.remark}</p> : null}
                  </div>
                  <div className="book-row-side">
                    <span className={getResultClassName(item.result)}>{resultLabels[item.result]}</span>
                  </div>
                </article>
              ))
            )}
          </section>

          <section className="books-list">
            <article className="hero-card compact">
              <p className="eyebrow">Scanned items</p>
              <h2>已掃描清單</h2>
              <p>列出本次盤點已經掃到的館藏與結果。</p>
            </article>

            {selectedSession.scannedItems.length === 0 ? (
              <div className="feedback">目前還沒有掃描任何館藏。</div>
            ) : (
              selectedSession.scannedItems.map((item) => (
                <article key={item.id} className="book-row">
                  <div className="book-row-main">
                    <h3>{item.title ?? "未命名書籍"}</h3>
                    <p>館藏條碼：{item.accessionCode ?? "無"}</p>
                    <p>ISBN：{item.isbn ?? "無"}</p>
                    <p>掃描時間：{formatDateTime(item.scannedAt)}</p>
                    {item.remark ? <p>備註：{item.remark}</p> : null}
                  </div>
                  <div className="book-row-side">
                    <span className={getResultClassName(item.result)}>{resultLabels[item.result]}</span>
                  </div>
                </article>
              ))
            )}
          </section>

          <section className="books-list">
            <article className="hero-card compact">
              <p className="eyebrow">Missing books</p>
              <h2>未掃到清單</h2>
              <p>列出本次盤點尚未掃到的館藏，便於後續查找。</p>
            </article>

            {selectedSession.missingBooks.length === 0 ? (
              <div className="feedback success">目前沒有未掃到的館藏。</div>
            ) : (
              selectedSession.missingBooks.map((book) => (
                <article key={book.id} className="book-row">
                  <div className="book-row-main">
                    <h3>{book.title}</h3>
                    <p>館藏條碼：{book.accessionCode}</p>
                    <p>ISBN：{book.isbn ?? "無"}</p>
                  </div>
                  <div className="book-row-side">
                    <span className="status-pill status-pill-overdue">未掃到</span>
                  </div>
                </article>
              ))
            )}
          </section>
        </section>
      ) : null}

      {loading ? <div className="feedback">讀取盤點資料中...</div> : null}
      {message ? <div className="feedback success">{message}</div> : null}
      {error ? <div className="feedback error">{error}</div> : null}
    </section>
  );
}
