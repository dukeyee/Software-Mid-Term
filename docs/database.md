# 資料庫版實作說明

## 資料表

- users：帳號、顯示名稱、角色、密碼雜湊、隨機鹽值、迭代次數及建立時間
- sessions：登入憑證的 SHA-256 雜湊、使用者編號及有效期限
- manuscripts：作者編號、類別、標題、內容、狀態、版本號及時間
- reviews：稿件編號、編輯編號、審查動作、退回原因、對應稿件版本與時間
- login_attempts：登入失敗次數及時間窗，限制同來源與帳號的連續錯誤嘗試

一位使用者可有多篇稿件，每篇稿件可有多次審查紀錄

manuscripts.author_id 對應 users.id，reviews.manuscript_id 對應 manuscripts.id，reviews.editor_id 對應 users.id

## 身分與權限

- 註冊帳號只允許建立 author，不能自行註冊 editor
- 密碼以 PBKDF2-SHA-256、100,000 次迭代和隨機鹽值產生雜湊，資料庫不保存明文密碼
- 登入成功產生 256 位元隨機憑證，資料庫僅保存憑證雜湊
- 工作階段有效七天，網站使用 HttpOnly、SameSite=Lax Cookie，HTTPS 上附加 Secure
- 登出會刪除對應工作階段並清除 Cookie
- 修改操作檢查 Origin，SQL 全部透過參數綁定執行
- 作者僅能讀寫自己的稿件，編輯僅能審查審查中稿件
- 稿件更新帶入版本號，資料庫使用條件 UPDATE，過期版本回傳 409
- 退回或通過時，審查紀錄與稿件狀態在同一個資料庫 batch 交易內寫入

## 部署

.openai/hosting.json 使用 d1: DB 宣告，Sites 在發布時配置雲端 Cloudflare D1，並先套用 drizzle/ 內的 migration

網站維持原有 owner-private 權限，先通過平台的 ChatGPT 私人網站存取，再進入投稿系統登入

BOOTSTRAP_KEY 是只存於部署環境的秘密值，用來一次性初始化示範帳號與虛構稿件，不會寫入 GitHub 或網頁程式

/api/setup 不會覆寫既有帳號密碼，且只有在稿件表為空時才建立指定的範例稿件

## 本機與雲端

本機使用 Node.js 內建 SQLite，路徑為 data/studio.sqlite；雲端使用 D1

兩者共用 schema 與 server/api.mjs，但資料彼此獨立

資料庫 migration 僅包含結構與索引，不包含帳號密碼或測試稿件

## 驗證

使用真正 SQLite 測試註冊、重複帳號、密碼驗證、登入工作階段、作者權限、非法來源、版本衝突、退回原因、審查紀錄與登出

另以檔案型 SQLite 驗證關閉再重開後帳號仍存在

雲端發布後另外檢查 D1 表結構，以及不同登入工作階段對同一篇稿件的讀取、送出與退回結果

## 資料移轉

舊版 localStorage 資料保留在各瀏覽器原本的網站來源，不自動上傳

舊版本機帳號沒有經過伺服器驗證，不應直接依照瀏覽器宣稱的作者編號匯入共用帳號

後續如需移轉，應先匯出資料並明確確認歸屬
