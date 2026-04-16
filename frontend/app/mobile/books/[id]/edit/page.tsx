"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useState,
  useTransition,
} from "react";

import { CameraCapture } from "../../../../components/camera-capture";
import { apiRequest, resolveAssetUrl } from "../../../../lib/api";
import { isAdminOperator } from "../../../../lib/auth";
import { uploadImage } from "../../../../lib/upload";

type BookStatus =
  | "available"
  | "loaned"
  | "lost"
  | "repair"
  | "inventory"
  | "inactive";

type BookDetailResponse = {
  item: {
    id: number;
    isbn: string | null;
    accessionCode: string;
    title: string;
    author: string | null;
    publisher: string | null;
    publishYear: number | null;
    coverUrl: string | null;
    status: BookStatus;
    remark: string | null;
  };
};

const statusOptions: Array<{ value: BookStatus; label: string }> = [
  { value: "available", label: "在館可借" },
  { value: "loaned", label: "借出中" },
  { value: "lost", label: "遺失" },
  { value: "repair", label: "維修中" },
  { value: "inventory", label: "盤點中" },
  { value: "inactive", label: "下架停用" },
];

export default function MobileBookEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const canManageStatus = isAdminOperator();
  const [isbn, setIsbn] = useState("");
  const [accessionCode, setAccessionCode] = useState("");
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [publisher, setPublisher] = useState("");
  const [publishYear, setPublishYear] = useState("");
  const [status, setStatus] = useState<BookStatus>("available");
  const [remark, setRemark] = useState("");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;

    async function loadBook() {
      try {
        const data = await apiRequest<BookDetailResponse>(`/api/books/${params.id}`);
        if (!active) {
          return;
        }

        setIsbn(data.item.isbn ?? "");
        setAccessionCode(data.item.accessionCode);
        setTitle(data.item.title);
        setAuthor(data.item.author ?? "");
        setPublisher(data.item.publisher ?? "");
        setPublishYear(data.item.publishYear ? String(data.item.publishYear) : "");
        setStatus(data.item.status);
        setRemark(data.item.remark ?? "");
        setCoverUrl(data.item.coverUrl ?? null);
        setCoverPreview(resolveAssetUrl(data.item.coverUrl) ?? null);
        setError(null);
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "讀取書籍資料失敗。");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadBook();

    return () => {
      active = false;
    };
  }, [params.id]);

  function setCapturedCover(file: File, previewUrl: string) {
    setCoverFile(file);
    setCoverPreview(previewUrl);
  }

  function handleCoverChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      setCoverFile(null);
      setCoverPreview(coverUrl);
      return;
    }

    setCapturedCover(file, URL.createObjectURL(file));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    startTransition(async () => {
      try {
        let nextCoverUrl = coverUrl;

        if (coverFile) {
          const upload = await uploadImage("/api/uploads/book-cover", coverFile);
          nextCoverUrl = upload.url;
        }

        await apiRequest<BookDetailResponse>(`/api/books/${params.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            isbn: isbn || null,
            accessionCode,
            title,
            author: author || null,
            publisher: publisher || null,
            publishYear: publishYear ? Number(publishYear) : null,
            coverUrl: nextCoverUrl,
            status,
            remark: remark || null,
          }),
        });

        setMessage("書籍資料已更新。");
        router.push("/mobile/books");
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "更新書籍失敗。");
      }
    });
  }

  return (
    <section className="mobile-stack">
      <article className="hero-card compact">
        <p className="eyebrow">Edit book</p>
        <h2>編輯書籍</h2>
        <p>狀態管理會取代刪除，用來表示借出、遺失、維修或下架。</p>
      </article>

      <section className="action-grid compact">
        <Link href="/mobile/books" className="action-card">
          <div className="action-badge">書籍</div>
          <h3>回到書籍清單</h3>
          <p>存檔後可回清單確認狀態與封面是否正確。</p>
        </Link>
      </section>

      {loading ? <div className="feedback">載入中...</div> : null}
      {error ? <div className="feedback error">{error}</div> : null}

      {!loading && !error ? (
        <form className="mobile-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>ISBN</span>
            <input value={isbn} onChange={(event) => setIsbn(event.target.value)} />
          </label>

          <label className="field">
            <span>館藏條碼</span>
            <input
              value={accessionCode}
              onChange={(event) => setAccessionCode(event.target.value)}
              required
            />
          </label>

          <label className="field">
            <span>書名</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} required />
          </label>

          <label className="field">
            <span>作者</span>
            <input value={author} onChange={(event) => setAuthor(event.target.value)} />
          </label>

          <label className="field">
            <span>出版社</span>
            <input value={publisher} onChange={(event) => setPublisher(event.target.value)} />
          </label>

          <label className="field">
            <span>出版年</span>
            <input
              type="number"
              min="0"
              max="9999"
              value={publishYear}
              onChange={(event) => setPublishYear(event.target.value)}
            />
          </label>

          <label className="field">
            <span>狀態</span>
            <select
              className="field-select"
              value={status}
              onChange={(event) => setStatus(event.target.value as BookStatus)}
              disabled={!canManageStatus}
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {!canManageStatus ? <small>只有 admin 可以修改書籍狀態。</small> : null}
          </label>

          <label className="field">
            <span>封面照片</span>
            <input type="file" accept="image/*" onChange={handleCoverChange} />
          </label>

          <CameraCapture label="重新拍封面" onCapture={setCapturedCover} />

          {coverPreview ? (
            <div className="cover-preview-card">
              <img src={coverPreview} alt="封面預覽" className="cover-preview-image" />
            </div>
          ) : null}

          <label className="field">
            <span>備註</span>
            <textarea
              value={remark}
              onChange={(event) => setRemark(event.target.value)}
              rows={4}
            />
          </label>

          <button type="submit" className="primary-button" disabled={isPending}>
            {isPending ? "更新中..." : "儲存變更"}
          </button>
        </form>
      ) : null}

      {message ? <div className="feedback success">{message}</div> : null}
    </section>
  );
}
