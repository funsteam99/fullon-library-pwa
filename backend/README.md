# Backend

Express + TypeScript + PostgreSQL API。

## 安裝

```bash
npm install
```

建立 `.env`：

```env
PORT=4000
DATABASE_URL=postgres://postgres:YOUR_PASSWORD@localhost:5432/library_system
CORS_ORIGIN=http://localhost:3000
```

## 啟動

```bash
npm run dev
```

編譯檢查：

```bash
npm run build
```

## API 範圍

- `books`
- `members`
- `loans`
- `inventory`
- `uploads`
- `health`

## ISBN lookup

Primary:
- Open Library
- Google Books

Fallback:
- 讀冊
- 博客來
- Amazon
- Amazon.co.jp
- CiNii Books

## 常用端點

- `GET /api/health`
- `GET /api/books`
- `GET /api/books/check`
- `GET /api/books/lookup/isbn/:isbn`
- `POST /api/books`
- `PATCH /api/books/:id`
- `GET /api/members`
- `POST /api/members`
- `PATCH /api/members/:id`
- `GET /api/loans`
- `GET /api/loans/overdue`
- `POST /api/loans/checkout`
- `POST /api/loans/return`
- `GET /api/inventory/sessions`
- `POST /api/inventory/sessions`
- `POST /api/inventory/sessions/:id/scan`
- `POST /api/uploads/book-cover`
- `POST /api/uploads/member-photo`

## 資料庫

先建立 `library_system`，再匯入：

```bash
psql -U postgres -d library_system -f ../database/schema.sql
```

如需測試資料：

```bash
psql -U postgres -d library_system -f ../database/dev-seed.sql
```

如果要補 `inactive` 書籍狀態：

```bash
psql -U postgres -d library_system -f ../database/migrations/20260320_add_inactive_book_status.sql
```

## 開發 log

- [backend-dev.log](/C:/Users/user/Documents/Playground/library-system/backend/backend-dev.log)
