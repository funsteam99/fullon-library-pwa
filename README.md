# fullon-library (Monorepo)

圖書館管理系統單一倉庫，包含：
- `frontend/` Next.js 前端（預設 :3000）
- `backend/` Node/TS API 後端（預設 :4000）

## 快速啟動

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Backend
```bash
cd backend
npm install
npm run dev
```

## 存取
- 前端：`http://localhost:3000/mobile`
- 後端健康檢查：`http://localhost:4000/api/health`

前端透過 rewrite 將 `/api/*` 轉發到 `http://localhost:4000/api/*`。

## 書籍建檔（目前流程）
在 `/mobile/books/new` 可混用以下方式：

1. 條碼掃描（Camera）
   - 掃 ISBN 或館藏條碼
   - 掃 ISBN 後可自動查詢候選書目

2. AI 圖片辨識
   - 可上傳或相機拍攝最多 3 張圖片（封面、版權頁等）
   - 點「用 AI 帶入欄位」後自動回填：ISBN、書名、作者、出版社、出版年
   - AI 圖片會保留，且可在「封面照片」區塊以縮圖挑選做為封面候選

3. 手動輸入
   - 可直接手動填寫所有欄位

## AI 辨識設定
Backend 需要環境變數（`backend/.env`）：

```env
GEMINI_API_KEY=your_api_key
GEMINI_MODEL=gemma-4-31b-it
GEMINI_FALLBACK_MODEL=gemini-3-flash-preview
AI_INGEST_TIMEOUT_MS=120000
```

相關 API：
- `POST /api/books/ingest/image`（multipart/form-data，欄位：`images`）

## Remote deployment notes (Windows + Tailscale)
See `docs/REMOTE_INSTALL_WINDOWS_TAILSCALE.md` for remote install steps and pitfall notes.
