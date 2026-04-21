# Fullon Library PWA

一套給圖書館/書房使用的行動化管理系統（Mobile-first），支援：
- 書籍建檔（掃碼、AI 辨識、手動）
- 會員管理
- 借還書流程
- 盤點與匯入/匯出

目前主線維護倉庫：
- **https://github.com/funsteam99/fullon-library-pwa**

---

## 專案簡介

`fullon-library-pwa` 是一個 monorepo：
- `frontend/`：Next.js 前端（預設 `:3000`）
- `backend/`：Node.js + TypeScript API（預設 `:4000`）

系統核心目標：
1. 降低建檔成本（掃 ISBN / AI 圖片辨識）
2. 手機端可直接操作借還書與盤點
3. 保留手動輸入彈性，確保現場可用性

---

## 功能總覽

- 書籍管理：新增、編輯、查詢
- 會員管理：新增、編輯、查詢
- 借還流程：借書、還書、逾期檢查
- 盤點流程：掃碼盤點、異常標記
- 資料匯入/匯出
- AI 輔助建檔：上傳或拍攝圖片後帶入欄位

---

## 技術棧

- Frontend: Next.js 15
- Backend: Express + TypeScript
- DB: PostgreSQL
- AI: Google Generative Language (OpenAI compatible endpoint)

---

## 目錄結構

```text
fullon-library-pwa/
├─ frontend/                # Next.js UI
├─ backend/                 # Express API
├─ scripts/                 # 維運/工具腳本
├─ docs/                    # 文件
└─ README.md
```

---

## 環境需求

- Node.js 20+
- npm 10+
- PostgreSQL 14+
- （選配）Python 3.10+（AI 圖片辨識腳本會用到）

---

## 首次安裝

### 1) 下載程式碼

```bash
git clone https://github.com/funsteam99/fullon-library-pwa.git
cd fullon-library-pwa
```

### 2) 安裝前後端依賴

```bash
cd frontend && npm install
cd ../backend && npm install
```

### 3) 建立資料庫

請先建立 PostgreSQL 資料庫（例如 `library_system`），再依 backend 文件匯入 schema。

### 4) 建立後端環境變數

建立 `backend/.env`：

```env
PORT=4000
DATABASE_URL=postgres://postgres:YOUR_PASSWORD@localhost:5432/library_system
CORS_ORIGIN=http://localhost:3000

# AI（選配，但建議）
GEMINI_API_KEY=your_api_key
GEMINI_MODEL=gemma-4-31b-it
GEMINI_FALLBACK_MODEL=gemini-3-flash-preview
AI_INGEST_TIMEOUT_MS=120000
```

### 5) 啟動服務（開發模式）

```bash
# terminal 1
cd backend
npm run dev

# terminal 2
cd frontend
npm run dev
```

開啟：
- Frontend: `http://localhost:3000/mobile`
- Backend health: `http://localhost:4000/api/health`

---

## 使用方法（各單元）

### 1) 書籍建檔（`/mobile/books/new`）
可混用以下方式：
1. 掃描 ISBN / 館藏條碼
2. AI 圖片辨識（上傳或相機拍攝，最多 3 張）
3. 手動輸入欄位

補上館藏條碼、封面與備註後送出建立書籍。

### 2) 會員管理（`/mobile/members`）
- 新增會員：填基本資料後建立
- 編輯會員：進入會員詳情或編輯頁更新資料
- 查詢會員：可依名稱/關鍵字快速篩選

### 3) 借書流程（`/mobile/loan`）
1. 選擇或掃描會員
2. 掃描館藏條碼 / ISBN 帶入書籍
3. 確認借閱資訊後送出借書

### 4) 還書流程（`/mobile/return`）
1. 掃描館藏條碼 / ISBN
2. 系統帶出目前借閱狀態
3. 確認後送出還書

### 5) 借閱總覽（`/mobile/loans`）
- 查看當前借閱紀錄
- 檢視逾期清單與狀態

### 6) 盤點流程（`/mobile/inventory`）
1. 建立或選擇盤點批次
2. 掃描書籍條碼/ISBN
3. 標記結果（found / wrong shelf / damaged / missing check）
4. 查看盤點統計與異常項目

### 7) 匯入/匯出（`/mobile/imports`、`/mobile/exports`）
- 匯入：批次導入書籍或會員資料
- 匯出：下載書籍、會員、借閱、盤點等資料

---

## API 速覽

- `GET /api/health`
- `GET /api/books`
- `POST /api/books`
- `GET /api/books/lookup/isbn/:isbn`
- `POST /api/books/ingest/image`（multipart，欄位 `images`）

---

## 部署與遠端安裝

Windows + Tailscale + SSH 參考：
- `docs/REMOTE_INSTALL_WINDOWS_TAILSCALE.md`

---

## 疑難排解

### 1) `AI 影像辨識失敗`
- 檢查 `GEMINI_API_KEY` 是否存在
- 檢查 backend log
- 若 timeout，可減少圖片數量或調整 `AI_INGEST_TIMEOUT_MS`

### 2) Frontend 出現 `Cannot find module './xxx.js'`
- 停掉 frontend
- 刪除 `frontend/.next`
- 重新 `npm run build` / `npm run start`

### 3) 掃描器無法啟動相機
- 確認瀏覽器權限
- 優先使用 localhost/HTTPS

---

## 開發與維護建議

- 優先在 `fullon-library-pwa` 開發，不再回寫舊 repo
- 變更後請更新 README / docs，避免維運資訊落差

---

## License

若未另行標註，請先視為保留所有權利（All rights reserved）。
