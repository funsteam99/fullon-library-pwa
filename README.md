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
