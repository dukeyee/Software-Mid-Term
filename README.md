# 稿間｜投稿審查系統

以 HTML、CSS、JavaScript 製作的繁體中文投稿審查網站，搭配伺服器 API 與真正的 SQL 資料庫

## 本機資料庫版入口

這台電腦已使用 XAMPP 的 MariaDB，資料庫名稱為 `software_mid_term`

1. 雙擊專案內的 `啟動本機網站.cmd`
2. 網站：http://127.0.0.1:4173/
3. 資料庫管理：http://127.0.0.1:8080/phpmyadmin/ ，在左側點選 `software_mid_term`

啟動檔會在背景啟動本機資料庫、網站與 phpMyAdmin 所需的 Apache，關閉啟動視窗不會停止網站

已從雲端複製 3 個帳號及 5 篇稿件到這台電腦，原雲端資料保留，兩邊之後的修改各自獨立，不會自動同步

完整設定、資料表用途與備份方式請見 [本機 MariaDB 操作說明](docs/local-mysql.md)

## 雲端資料庫版入口

https://dukeyee-submission-review.familiarboot4.chatgpt.site/

網站已設為公開，可直接開啟，再以投稿系統帳號登入

GitHub Pages 仍可作為入口，但會跳轉到上述後端網站，因為 GitHub Pages 本身只能託管靜態網頁，無法執行這套資料庫 API

## 現在的架構

本機：瀏覽器 → Node.js API → XAMPP MariaDB

雲端：瀏覽器 → 同來源 Worker API → Cloudflare D1（SQLite）

- 帳號、密碼驗證資料、登入工作階段、稿件與審查紀錄皆保存在伺服器資料庫
- 不同瀏覽器登入同一個投稿帳號，可以讀取相同資料
- 所有操作均由伺服器驗證登入身分、角色、稿件所有權及狀態
- 以稿件版本號避免舊畫面覆寫別人已更新的內容
- 資料庫版不再以 localStorage 或 sessionStorage 作為帳號、稿件或登入狀態的來源

## 功能

- 作者註冊、登入、登出
- 作者查看自己的稿件，新增、修改、刪除編輯中稿件，以及送出投稿
- 編輯查看審查中稿件，通過或填寫原因後退回
- 作者可在稿件內容與編輯表單查看上次退回原因
- 每次審查保存在獨立的 reviews 資料表，保留歷次紀錄
- 深色模式、放大字體、手機版排版、搜尋與狀態篩選
- 點選「更新資料」或重新整理，可取得資料庫中的最新內容

## 課堂示範帳號

- 奶龍：nailong
- 奶蛙：naiwa
- 自由時報：editor
- 三個示範帳號的密碼均為 demo123，供課堂展示使用

新註冊帳號一律為作者身分，請使用自己的帳號保存個人投稿

## 本機執行

需要 Node.js 22.13 或更新版本、pnpm，以及 XAMPP，預設安裝位置為 `C:/xampp`

目前這台電腦已設定完成，使用啟動檔即可，重新下載專案時的初始化步驟請見 [本機設定文件](docs/local-mysql.md)

也可在終端機執行

```sh
pnpm start
```

連線設定存於 `.env.local`，資料庫資料與連線密碼不會上傳到 GitHub

### 保留的 SQLite 開發模式

若要使用原本的獨立 SQLite 測試資料庫，先停止佔用 4173 的網站，再執行

```sh
node scripts/database-server.mjs
```

開啟 http://127.0.0.1:4173

首次啟動會建立 data/studio.sqlite、套用 SQL migration，並初始化三個示範帳號

data/ 已加入 .gitignore，資料庫檔案不會上傳到 GitHub

本機 SQLite 與雲端 D1 是兩個獨立資料庫，本機測試資料不會自動上傳

## 建置與驗證

```sh
node --test tests/*.test.cjs
node scripts/build-worker.cjs
```

Worker 建置輸出為 dist/server/index.js，內含 API 與網頁資產

產生新 migration 時，先安裝 package.json 中指定的開發工具

```sh
pnpm install
node node_modules/drizzle-kit/bin.cjs generate
```

已套用的 migration 不可修改；新增結構變更時應產生新的 migration

## 程式結構

- web/：畫面、深色樣式、表單與 API 請求
- server/api.mjs：註冊、登入、工作階段與投稿審查 API
- server/sqlite-adapter.mjs：本機 SQLite 與 D1 相容的查詢介面
- db/schema.ts：資料表定義
- drizzle/：由 Drizzle 產生的 SQL migration 與結構 metadata
- scripts/database-server.mjs：本機伺服器與本機 migration
- scripts/build-worker.cjs：將網站與 API 打包為 Worker
- tests/database-api.test.cjs：以真正 SQLite 執行的 API 整合測試
- docs/database.md：資料表、驗證與部署說明

舊版 web/auth.js 與 scripts/build.cjs 保留供歷史版本參考，資料庫版不載入舊版瀏覽器密碼驗證程式，也不使用靜態建置腳本

## 舊版資料

舊版儲存在各瀏覽器 localStorage 的帳號與稿件未被刪除，也不會自動併入共用資料庫

請在新版重新註冊，舊稿件如需移轉應先匯出並確認歸屬，再進行明確的資料匯入

## 文件

- docs/requirements.md：原始 PPT 要求與第一版規劃
- docs/development-plan.md：最初七天開發規劃
- docs/acceptance-tests.md：原始驗收清單
- docs/implementation.md：實作歷程
- docs/database.md：目前資料庫版架構
