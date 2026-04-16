"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { apiRequest, resolveAssetUrl } from "../../lib/api";

type BookStatus =
  | "available"
  | "loaned"
  | "lost"
  | "repair"
  | "inventory"
  | "inactive";

type BooksResponse = {
  items: Array<{
    id: number;
    title: string;
    accessionCode: string;
    isbn: string | null;
    author: string | null;
    status: BookStatus;
    coverUrl?: string | null;
  }>;
};

const statusLabels: Record<BookStatus, string> = {
  available: "在館可借",
  loaned: "借出中",
  lost: "遺失",
  repair: "維修中",
  inventory: "盤點中",
  inactive: "下架停用",
};

const statusClasses: Record<BookStatus, string> = {
  available: "status-pill status-pill-returned",
  loaned: "status-pill status-pill-loaned",
  lost: "status-pill status-pill-overdue",
  repair: "status-pill status-pill-overdue-returned",
  inventory: "status-pill status-pill-loaned",
  inactive: "status-pill",
};

export default function MobileBooksPage() {
  const [items, setItems] = useState<BooksResponse["items"]>([]);
  const [keyword, setKeyword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadBooks() {
      try {
        const data = await apiRequest<BooksResponse>("/api/books");

        if (!active) {
          return;
        }

        setItems(data.items);
        setError(null);
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "書籍清單載入失敗");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadBooks();

    return () => {
      active = false;
    };
  }, []);

  const filteredItems = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();

    if (!normalized) {
      return items;
    }

    return items.filter((book) =>
      [book.title, book.accessionCode, book.isbn, book.author]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized)),
    );
  }, [items, keyword]);

  return (
    <section className="mobile-stack">
      <article className="hero-card compact">
        <p className="eyebrow">Books</p>
        <h2>書籍清單</h2>
        <p>可搜尋書名、館藏條碼、作者或 ISBN，並直接進入編輯。</p>
      </article>

      <section className="action-grid">
        <Link href="/mobile/books/new" className="action-card">
          <div className="action-badge">新增</div>
          <h3>建立新書籍</h3>
          <p>掃 ISBN、補封面與欄位後，快速完成建檔。</p>
        </Link>
        <Link href="/mobile" className="action-card">
          <div className="action-badge">首頁</div>
          <h3>返回首頁</h3>
          <p>回到借還、會員、盤點等主要入口。</p>
        </Link>
      </section>

      <section className="mobile-form">
        <label className="field">
          <span>搜尋書籍</span>
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="輸入書名、作者、館藏條碼或 ISBN"
          />
        </label>
      </section>

      <section className="books-list">
        {loading ? <div className="feedback">載入中...</div> : null}
        {error ? <div className="feedback error">{error}</div> : null}

        {!loading && !error && filteredItems.length === 0 ? (
          <div className="feedback">
            {keyword ? "查無符合搜尋條件的書籍" : "目前還沒有書籍資料"}
          </div>
        ) : null}

        {!loading && !error
          ? filteredItems.map((book) => (
              <article key={book.id} className="book-row book-row-with-cover">
                <div className="book-cover-slot">
                  {book.coverUrl ? (
                    <img
                      src={resolveAssetUrl(book.coverUrl) ?? undefined}
                      alt={`${book.title} 封面`}
                      className="book-cover-thumb"
                      loading="lazy"
                    />
                  ) : (
                    <div className="book-cover-placeholder">無封面</div>
                  )}
                </div>

                <div className="book-row-main">
                  <h3>{book.title}</h3>
                  <p>館藏條碼：{book.accessionCode}</p>
                  <p>ISBN：{book.isbn ?? "未填寫"}</p>
                  <p>作者：{book.author ?? "未填寫"}</p>
                </div>

                <div className="book-row-side">
                  <span className={statusClasses[book.status] ?? "status-pill"}>
                    {statusLabels[book.status] ?? book.status}
                  </span>
                  <Link href={`/mobile/books/${book.id}/edit`} className="inline-link">
                    編輯
                  </Link>
                </div>
              </article>
            ))
          : null}
      </section>
    </section>
  );
}
