# Frontend

Next.js App Router 手機優先 PWA。

## 安裝

```bash
npm install
```

## 啟動

```bash
npm run dev
```

## 主要頁面

- `/`
- `/mobile`
- `/mobile/books`
- `/mobile/books/new`
- `/mobile/books/:id/edit`
- `/mobile/members`
- `/mobile/members/new`
- `/mobile/members/:id/edit`
- `/mobile/loan`
- `/mobile/return`
- `/mobile/inventory`

## 相機與掃碼

- ISBN / 條碼掃描：`html5-qrcode`
- 封面 / 會員照片：browser webcam + file upload
- iPhone 掃碼需 `HTTPS`
- 桌機 webcam 會先嘗試 `2x` 變焦

## API

前端預設走同源 `/api`。

開發模式常見組合：
- `frontend`: `http://localhost:3000`
- `backend`: `http://localhost:4000`
- 內網入口：`https://192.168.0.112`

若用 Caddy 代理，手機可直接走：
- `https://192.168.0.112/mobile`

## 開發 log

- [frontend-dev.log](/C:/Users/user/Documents/Playground/library-system/frontend/frontend-dev.log)
