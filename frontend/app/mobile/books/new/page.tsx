"use client";

import Link from "next/link";
import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

import { BarcodeScanner } from "../../../components/barcode-scanner";
import { CameraCapture } from "../../../components/camera-capture";
import { apiRequest, getApiUrl } from "../../../lib/api";
import { uploadImage } from "../../../lib/upload";
import { getOperatorRequestHeaders } from "../../../lib/auth";

type ScanMode = "auto" | "isbn" | "accession";

type LookupSource = {
  id: string;
  label: string;
};

type LookupItem = {
  title: string | null;
  author: string | null;
  publisher: string | null;
  publishYear: number | null;
  coverUrl: string | null;
  source: string | null;
};

type LookupCandidate = {
  item: LookupItem;
  matchedSource: LookupSource | null;
  foundFields: string[];
  completenessScore: number;
};

type LookupResponse = {
  item: LookupItem | null;
  found: boolean;
  message: string | null;
  attemptedSources: LookupSource[];
  matchedSource: LookupSource | null;
  foundFields: string[];
  candidates: LookupCandidate[];
};

type BookSummary = {
  id: number;
  title: string;
  accessionCode: string;
  isbn: string | null;
  author: string | null;
};

type DuplicateCheckResponse = {
  item: {
    isbn: string;
    accessionCode: string;
    isbnMatches: BookSummary[];
    accessionMatch: BookSummary | null;
  };
};

type CreateBookResponse = {
  item: {
    id: number;
    title: string;
    accessionCode: string;
  };
};

type AiIngestResponse = {
  item: {
    title: string | null;
    author: string | null;
    publisher: string | null;
    publishYear: number | null;
    isbn: string | null;
    confidence: number | null;
    notes: string | null;
  };
};

const REQUIRED_METADATA_FIELDS = ["書名", "作者", "出版社", "出版年"] as const;

const scanModeOptions: Array<{ value: ScanMode; label: string; helper: string }> = [
  {
    value: "auto",
    label: "自動判斷",
    helper: "第一次掃描先帶入 ISBN，第二次掃描再帶入館藏條碼。",
  },
  {
    value: "isbn",
    label: "掃 ISBN",
    helper: "每次掃描都會覆蓋 ISBN，並重新查詢書籍資料。",
  },
  {
    value: "accession",
    label: "掃館藏條碼",
    helper: "每次掃描都會覆蓋館藏條碼。",
  },
];

function normalizeIsbnValue(value: string) {
  return value.replace(/[^0-9Xx]/g, "");
}

function isLikelyCompleteIsbn(value: string) {
  const normalized = normalizeIsbnValue(value);
  return normalized.length === 10 || normalized.length === 13;
}

function resolveAiIngestUrl() {
  if (typeof window === "undefined") {
    return getApiUrl("/api/books/ingest/image");
  }

  const host = window.location.hostname;
  const isLocalLike = host === "localhost" || host === "127.0.0.1" || host.startsWith("192.168.");

  if (window.location.protocol === "http:" && isLocalLike) {
    return `http://${host}:4000/api/books/ingest/image`;
  }

  return getApiUrl("/api/books/ingest/image");
}

export default function MobileBookCreatePage() {
  const [scanMode, setScanMode] = useState<ScanMode>("auto");
  const [scannerCloseSignal, setScannerCloseSignal] = useState(0);
  const [isbn, setIsbn] = useState("");
  const [accessionCode, setAccessionCode] = useState("");
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [publisher, setPublisher] = useState("");
  const [publishYear, setPublishYear] = useState("");
  const [remark, setRemark] = useState("");
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [aiFiles, setAiFiles] = useState<File[]>([]);
  const [aiPreviewUrls, setAiPreviewUrls] = useState<string[]>([]);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [isAiPending, setIsAiPending] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const [lookupTrace, setLookupTrace] = useState<{
    attemptedSources: LookupSource[];
    matchedSource: LookupSource | null;
    foundFields: string[];
  }>({
    attemptedSources: [],
    matchedSource: null,
    foundFields: [],
  });
  const [lookupCandidates, setLookupCandidates] = useState<LookupCandidate[]>([]);
  const [activeCandidateIndex, setActiveCandidateIndex] = useState(0);
  const [duplicateMessage, setDuplicateMessage] = useState<string | null>(null);
  const [duplicateBooks, setDuplicateBooks] = useState<BookSummary[]>([]);
  const [hasAccessionConflict, setHasAccessionConflict] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [createdBookId, setCreatedBookId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const lastLookedUpIsbn = useRef("");

  const canUseIsbnAsAccession = useMemo(() => isbn.trim().length > 0, [isbn]);
  const activeCandidate = lookupCandidates[activeCandidateIndex] ?? null;

  useEffect(() => {
    const urls = aiFiles.map((file) => URL.createObjectURL(file));
    setAiPreviewUrls(urls);

    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [aiFiles]);

  function closeScannerForManualInput() {
    setScannerCloseSignal((value) => value + 1);
  }

  function clearLookupState() {
    setLookupMessage(null);
    setLookupTrace({
      attemptedSources: [],
      matchedSource: null,
      foundFields: [],
    });
    setLookupCandidates([]);
    setActiveCandidateIndex(0);
    lastLookedUpIsbn.current = "";
  }

  function resetForNextBook() {
    setIsbn("");
    setAccessionCode("");
    setTitle("");
    setAuthor("");
    setPublisher("");
    setPublishYear("");
    setRemark("");
    setCoverPreview(null);
    setCoverFile(null);
    clearLookupState();
    setDuplicateMessage(null);
    setDuplicateBooks([]);
    setHasAccessionConflict(false);
    setError(null);
  }

  function applyLookupCandidate(candidate: LookupCandidate) {
    if (candidate.item.title) {
      setTitle(candidate.item.title);
    }
    if (candidate.item.author) {
      setAuthor(candidate.item.author);
    }
    if (candidate.item.publisher) {
      setPublisher(candidate.item.publisher);
    }
    if (typeof candidate.item.publishYear === "number") {
      setPublishYear(String(candidate.item.publishYear));
    }
    if (candidate.item.coverUrl) {
      setCoverPreview(candidate.item.coverUrl);
      setCoverFile(null);
    }

    setLookupTrace((current) => ({
      attemptedSources: current.attemptedSources,
      matchedSource: candidate.matchedSource,
      foundFields: candidate.foundFields,
    }));
  }

  function applyCandidateAtIndex(nextIndex: number) {
    const candidate = lookupCandidates[nextIndex];

    if (!candidate) {
      return;
    }

    setActiveCandidateIndex(nextIndex);
    applyLookupCandidate(candidate);
    setLookupMessage(
      `已套用第 ${nextIndex + 1} / ${lookupCandidates.length} 筆資料，來源：${candidate.matchedSource?.label ?? "未知來源"}`,
    );
  }

  function showNextLookupCandidate() {
    if (lookupCandidates.length <= 1) {
      return;
    }

    const nextIndex = (activeCandidateIndex + 1) % lookupCandidates.length;
    applyCandidateAtIndex(nextIndex);
  }

  function handleCoverSelected(file: File, previewUrl: string) {
    setCoverFile(file);
    setCoverPreview(previewUrl);
    setError(null);
  }

  function handleCoverChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      setCoverFile(null);
      setCoverPreview(null);
      return;
    }

    handleCoverSelected(file, URL.createObjectURL(file));
  }

  async function checkDuplicates(nextIsbn: string, nextAccessionCode: string) {
    const params = new URLSearchParams();

    if (nextIsbn.trim()) {
      params.set("isbn", nextIsbn.trim());
    }

    if (nextAccessionCode.trim()) {
      params.set("accessionCode", nextAccessionCode.trim());
    }

    if (!params.toString()) {
      setDuplicateMessage(null);
      setDuplicateBooks([]);
      setHasAccessionConflict(false);
      return;
    }

    try {
      const response = await apiRequest<DuplicateCheckResponse>(`/api/books/check?${params.toString()}`);
      const isbnMatches = response.item.isbnMatches ?? [];
      const accessionMatch = response.item.accessionMatch;
      const messages: string[] = [];

      setDuplicateBooks(isbnMatches);
      setHasAccessionConflict(Boolean(accessionMatch));

      if (isbnMatches.length > 0) {
        messages.push(`此 ISBN 已有 ${isbnMatches.length} 筆館藏紀錄。`);
      }

      if (accessionMatch) {
        messages.push(`館藏條碼 ${accessionMatch.accessionCode} 已存在。`);
      }

      setDuplicateMessage(messages.length > 0 ? messages.join(" ") : null);
    } catch {
      setDuplicateMessage("重複資料檢查失敗，請稍後再試。");
      setDuplicateBooks([]);
      setHasAccessionConflict(false);
    }
  }

  async function lookupIsbnMetadata(nextIsbn: string, force = false) {
    const normalized = nextIsbn.trim();

    if (!normalized) {
      clearLookupState();
      return;
    }

    if (!force && lastLookedUpIsbn.current === normalized) {
      return;
    }

    lastLookedUpIsbn.current = normalized;
    setLookupMessage("正在比對多個來源的書籍資料...");
    setLookupTrace({
      attemptedSources: [],
      matchedSource: null,
      foundFields: [],
    });
    setLookupCandidates([]);
    setActiveCandidateIndex(0);
    setError(null);

    try {
      const payload = await apiRequest<LookupResponse>(
        `/api/books/lookup/isbn/${encodeURIComponent(normalized)}`,
      );

      setLookupTrace({
        attemptedSources: payload.attemptedSources ?? [],
        matchedSource: payload.matchedSource ?? null,
        foundFields: payload.foundFields ?? [],
      });

      const candidates = payload.candidates ?? [];
      setLookupCandidates(candidates);
      setActiveCandidateIndex(0);

      if (candidates.length === 0 || !payload.item) {
        setLookupMessage("查不到可用的書目資料，請直接手動輸入。");
        return;
      }

      applyLookupCandidate(candidates[0]);

      const missingRequiredFields = REQUIRED_METADATA_FIELDS.filter(
        (field) => !candidates[0].foundFields.includes(field),
      );

      if (missingRequiredFields.length === 0) {
        setLookupMessage(
          `找到 ${candidates.length} 筆候選資料，已先帶入最完整的一筆。可按「下一筆」切換。`,
        );
      } else {
        setLookupMessage(
          `找到 ${candidates.length} 筆候選資料，已先帶入目前最完整的一筆；仍缺少 ${missingRequiredFields.join("、")}。`,
        );
      }
    } catch (lookupError) {
      setLookupMessage(
        lookupError instanceof Error ? lookupError.message : "查詢書籍資料失敗，請稍後再試。",
      );
    }
  }

  function handleBookCodeDetected(code: string) {
    const nextCode = code.trim();

    if (!nextCode) {
      return;
    }

    if (createdBookId || message) {
      resetForNextBook();
      setCreatedBookId(null);
      setMessage(null);
    }

    if (scanMode === "isbn") {
      setIsbn(nextCode);
      void checkDuplicates(nextCode, accessionCode);
      void lookupIsbnMetadata(nextCode, true);
      return;
    }

    if (scanMode === "accession") {
      setAccessionCode(nextCode);
      void checkDuplicates(isbn, nextCode);
      return;
    }

    if (!isbn.trim()) {
      setIsbn(nextCode);
      void checkDuplicates(nextCode, accessionCode);
      void lookupIsbnMetadata(nextCode, true);
      return;
    }

    setAccessionCode(nextCode);
    void checkDuplicates(isbn, nextCode);
  }

  function applyIsbnToAccessionCode() {
    const nextAccessionCode = isbn.trim();

    if (!nextAccessionCode) {
      return;
    }

    setAccessionCode(nextAccessionCode);
    void checkDuplicates(isbn, nextAccessionCode);
  }

  function handleIsbnBlur() {
    const normalized = isbn.trim();

    if (!normalized) {
      return;
    }

    if (!isLikelyCompleteIsbn(normalized)) {
      setLookupMessage("ISBN 尚未輸入完整，先暫停查詢；輸入完整後再自動帶入資料。");
      return;
    }

    void checkDuplicates(normalized, accessionCode);
    void lookupIsbnMetadata(normalized);
  }

  function handleAccessionBlur() {
    void checkDuplicates(isbn, accessionCode);
  }

  function handleAiCameraCapture(file: File) {
    setAiFiles((prev) => {
      const next = [...prev, file];
      return next.slice(0, 3);
    });
    setAiMessage("已加入相機圖片，可執行 AI 辨識。");
  }

  function useAiImageAsCover(index: number) {
    const file = aiFiles[index];
    const previewUrl = aiPreviewUrls[index];

    if (!file || !previewUrl) {
      return;
    }

    setCoverFile(file);
    setCoverPreview(previewUrl);
    setAiMessage(`已將第 ${index + 1} 張 AI 圖片設為封面候選。`);
  }

  async function handleAiIngest() {
    if (aiFiles.length === 0) {
      setAiMessage("請先選擇至少一張圖片。");
      return;
    }

    setIsAiPending(true);
    setAiMessage("AI 辨識中...");
    setError(null);

    try {
      const formData = new FormData();
      aiFiles.forEach((file) => formData.append("images", file));

      const response = await fetch(resolveAiIngestUrl(), {
        method: "POST",
        headers: {
          ...getOperatorRequestHeaders(),
        },
        body: formData,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        const detail = payload.message?.trim();
        const reason = detail || `HTTP ${response.status} ${response.statusText}`;
        throw new Error(`AI 影像辨識失敗：${reason}`);
      }

      const payload = (await response.json()) as AiIngestResponse;
      const item = payload.item;

      if (item.isbn) {
        setIsbn(item.isbn);
        void checkDuplicates(item.isbn, accessionCode);
      }
      if (item.title) setTitle(item.title);
      if (item.author) setAuthor(item.author);
      if (item.publisher) setPublisher(item.publisher);
      if (typeof item.publishYear === "number") setPublishYear(String(item.publishYear));
      const notes = item.notes ?? "";
      if (notes) setRemark((prev) => (prev ? `${prev}\n${notes}` : notes));

      setAiMessage(`AI 已帶入欄位${item.confidence != null ? `（信心 ${Math.round(item.confidence * 100)}%）` : ""}。`);
      setAiFiles([]);
    } catch (ingestError) {
      const base = ingestError instanceof Error ? ingestError.message : "AI 影像辨識失敗";
      let hint = "";
      if (base.includes("missing GEMINI_API_KEY")) {
        hint = "（後端未設定 GEMINI_API_KEY）";
      } else if (base.includes("No images uploaded")) {
        hint = "（尚未選擇圖片）";
      } else if (base.includes("timeout") || base.includes("timed out")) {
        hint = "（模型回應逾時，請重試或減少圖片張數）";
      } else if (base.includes("429") || base.includes("rate")) {
        hint = "（API 速率限制，稍後再試）";
      }
      setAiMessage(`${base}${hint}`);
    } finally {
      setIsAiPending(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setCreatedBookId(null);
    setError(null);

    if (hasAccessionConflict) {
      setError("館藏條碼已存在，請改用其他條碼。");
      return;
    }

    startTransition(async () => {
      try {
        let coverUrl = coverPreview;

        if (coverFile) {
          const upload = await uploadImage("/api/uploads/book-cover", coverFile);
          coverUrl = upload.url;
        }

        const payload = await apiRequest<CreateBookResponse>("/api/books", {
          method: "POST",
          body: JSON.stringify({
            isbn: isbn.trim() || null,
            accessionCode: accessionCode.trim() || isbn.trim(),
            title: title.trim(),
            author: author.trim() || null,
            publisher: publisher.trim() || null,
            publishYear: publishYear.trim() ? Number(publishYear.trim()) : null,
            coverUrl: coverUrl || null,
            remark: remark.trim() || null,
            status: "available",
          }),
        });

        setCreatedBookId(payload.item.id);
        setMessage(`已建立《${payload.item.title}》，館藏條碼 ${payload.item.accessionCode}。`);
        resetForNextBook();
      } catch (submitError) {
        setError(
          submitError instanceof Error ? submitError.message : "建立書籍失敗，請稍後再試。",
        );
      }
    });
  }

  return (
    <section className="mobile-stack">
      <article className="hero-card compact">
        <p className="eyebrow">Book intake</p>
        <h2>書籍建檔</h2>
        <p>
          建檔流程可三選一或混用：先掃描 ISBN 自動帶入資料、用 AI 辨識封面/版權頁補欄位，
          或直接手動輸入。最後補上館藏條碼、封面與備註後送出。
        </p>
      </article>

      <section className="action-grid compact">
        <Link href="/mobile/books" className="action-card">
          <div className="action-badge">書籍</div>
          <h3>查看書籍清單</h3>
          <p>建檔完成後可回清單確認資料與封面是否正確。</p>
        </Link>
      </section>

      <section className="mobile-form">
        <div className="field">
          <span>掃碼模式</span>
          <div className="segmented-control" role="tablist" aria-label="掃碼模式">
            {scanModeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`segmented-button ${scanMode === option.value ? "active" : ""}`}
                onClick={() => setScanMode(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <small>{scanModeOptions.find((option) => option.value === scanMode)?.helper}</small>
        </div>
      </section>

      <BarcodeScanner
        label="開啟掃描"
        helperText="可掃 ISBN 或館藏條碼。若要手動輸入 ISBN，點入欄位後會自動關閉掃描器。"
        onDetected={handleBookCodeDetected}
        closeSignal={scannerCloseSignal}
        labelButtonClassName="scan-action-button"
      />

      <section className="mobile-form">
        <div className="field">
          <span>AI 圖片辨識（選填）</span>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              setAiFiles(files.slice(0, 3));
              setAiMessage(files.length > 0 ? `已選擇 ${Math.min(files.length, 3)} 張` : null);
            }}
          />
          <small>可上傳封面/版權頁，最多 3 張，帶入 ISBN、書名、作者、出版社、出版年。</small>
        </div>
        <div className="inline-actions">
          <button type="button" className="ghost-button ai-action-button" onClick={() => void handleAiIngest()} disabled={isAiPending || aiFiles.length === 0}>
            {isAiPending ? "AI 辨識中..." : "用 AI 帶入欄位"}
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={() => {
              setAiFiles([]);
              setAiMessage("已清空 AI 圖片");
            }}
            disabled={aiFiles.length === 0}
          >
            清空 AI 圖片
          </button>
        </div>
        <small>目前 AI 圖片數量：{aiFiles.length} / 3</small>
        <CameraCapture label="用相機拍 AI 辨識圖片" onCapture={(file) => handleAiCameraCapture(file)} />

        {aiFiles.length > 0 ? (
          <div className="feedback-meta">
            <div>AI 圖片可作為封面候選（點選套用）：</div>
            <div className="inline-actions">
              {aiFiles.map((file, index) => (
                <button
                  key={`${file.name}-${index}`}
                  type="button"
                  className="ghost-button"
                  onClick={() => useAiImageAsCover(index)}
                  title="設為封面候選"
                >
                  {index + 1}. {file.name || `相機圖片 ${index + 1}`}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {aiMessage ? <div className="feedback">{aiMessage}</div> : null}
      </section>

      <form className="mobile-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>ISBN</span>
          <input
            value={isbn}
            onChange={(event) => {
              closeScannerForManualInput();
              setIsbn(event.target.value);
              setLookupMessage(null);
              setError(null);
            }}
            onFocus={closeScannerForManualInput}
            onBlur={handleIsbnBlur}
            placeholder="例如 9789866076510"
            inputMode="numeric"
          />
        </label>

        <div className="inline-actions">
          <button
            type="button"
            className="ghost-button"
            onClick={() => {
              void checkDuplicates(isbn, accessionCode);
              void lookupIsbnMetadata(isbn, true);
            }}
            disabled={!isbn.trim()}
          >
            用 ISBN 查資料
          </button>
          <button type="button" className="ghost-button" onClick={() => setScanMode("isbn")}>
            下次掃 ISBN
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={() => setScanMode("accession")}
          >
            下次掃館藏條碼
          </button>
        </div>

        <label className="field">
          <span>館藏條碼</span>
          <input
            value={accessionCode}
            onChange={(event) => {
              setAccessionCode(event.target.value);
              setError(null);
            }}
            onBlur={handleAccessionBlur}
            placeholder="例如 B0002"
            autoCapitalize="characters"
          />
        </label>

        <div className="inline-actions">
          <button
            type="button"
            className="ghost-button"
            onClick={applyIsbnToAccessionCode}
            disabled={!canUseIsbnAsAccession}
          >
            用 ISBN 當館藏條碼
          </button>
        </div>

        {lookupMessage ? <div className="feedback">{lookupMessage}</div> : null}

        {lookupCandidates.length > 0 ? (
          <div className="feedback-meta">
            <div>
              目前候選：{activeCandidateIndex + 1} / {lookupCandidates.length}
            </div>
            <div>來源：{activeCandidate?.matchedSource?.label ?? "未知來源"}</div>
            <div>完整度：{activeCandidate?.completenessScore ?? 0} / 5</div>
            <div>
              已找到欄位：
              {activeCandidate && activeCandidate.foundFields.length > 0
                ? activeCandidate.foundFields.join("、")
                : "尚未找到"}
            </div>
            {lookupCandidates.length > 1 ? (
              <div className="inline-actions">
                <button type="button" className="ghost-button" onClick={showNextLookupCandidate}>
                  下一筆
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {lookupTrace.attemptedSources.length > 0 ? (
          <div className="feedback-meta">
            <div>查詢來源：{lookupTrace.attemptedSources.map((source) => source.label).join("、")}</div>
            <div>目前套用：{lookupTrace.matchedSource?.label ?? "尚未命中來源"}</div>
            <div>
              目前欄位：
              {lookupTrace.foundFields.length > 0 ? lookupTrace.foundFields.join("、") : "尚未找到欄位"}
            </div>
          </div>
        ) : null}

        {duplicateMessage ? <div className="feedback error">{duplicateMessage}</div> : null}

        {duplicateBooks.length > 0 ? (
          <div className="feedback-meta">
            <div>此 ISBN 既有館藏：</div>
            {duplicateBooks.map((book) => (
              <div key={book.id}>
                #{book.id} {book.title} / {book.accessionCode}
              </div>
            ))}
          </div>
        ) : null}

        <label className="field">
          <span>書名</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="例如 Arduino 快速上手指南"
            required
          />
        </label>

        <label className="field">
          <span>作者</span>
          <input
            value={author}
            onChange={(event) => setAuthor(event.target.value)}
            placeholder="例如 Maik Schmidt"
          />
        </label>

        <label className="field">
          <span>出版社</span>
          <input
            value={publisher}
            onChange={(event) => setPublisher(event.target.value)}
            placeholder="例如 馥林文化"
          />
        </label>

        <label className="field">
          <span>出版年</span>
          <input
            value={publishYear}
            onChange={(event) => setPublishYear(event.target.value)}
            placeholder="例如 2012"
            inputMode="numeric"
          />
        </label>

        <label className="field">
          <span>封面照片</span>
          <input type="file" accept="image/*" onChange={handleCoverChange} />
        </label>

        <CameraCapture label="用桌機相機拍封面" onCapture={handleCoverSelected} />

        {coverPreview ? (
          <div className="cover-preview-card">
            <img src={coverPreview} alt="書籍封面預覽" className="cover-preview-image" />
          </div>
        ) : null}

        <label className="field">
          <span>備註</span>
          <textarea
            value={remark}
            onChange={(event) => setRemark(event.target.value)}
            placeholder="可記錄書況、版本或其他補充資訊"
            rows={4}
          />
        </label>

        <button type="submit" className="primary-button" disabled={isPending}>
          {isPending ? "建立書籍中..." : "建立書籍"}
        </button>
      </form>

      {message ? (
        <div className="feedback success">
          <div>{message}</div>
          <div className="feedback-link-row">
            <Link href="/mobile/books" className="inline-link">
              看全部書籍
            </Link>
            {createdBookId ? <span className="feedback-meta">ID: {createdBookId}</span> : null}
          </div>
        </div>
      ) : null}

      {error ? <div className="feedback error">{error}</div> : null}
    </section>
  );
}
