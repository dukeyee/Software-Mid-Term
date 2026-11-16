# 電腦本機 MariaDB 操作說明

## 日常開啟

雙擊專案根目錄的 `啟動本機網站.cmd`，看到 Website 與 Database manager 網址即代表啟動成功

- 投稿網站：http://127.0.0.1:4173/
- 資料庫管理：http://127.0.0.1:8080/phpmyadmin/
- 資料庫名稱：`software_mid_term`

關閉命令視窗不會停止服務，重新開機後需再次執行啟動檔

網站與管理介面僅監聽這台電腦的 127.0.0.1，其他人的電腦無法透過這些網址連線

## 查看資料

在 phpMyAdmin 左側點選 `software_mid_term`，可看到以下資料表

- `users`：帳號、顯示名稱、角色、密碼雜湊與鹽值，密碼不以明文儲存
- `manuscripts`：稿件、作者、狀態與版本
- `reviews`：每次通過或退回的審查紀錄
- `sessions`：登入工作階段
- `login_attempts`：登入失敗次數與限制資訊
- `studio_meta`：專案識別與匯入來源資訊

點選資料表旁的 Browse／瀏覽查看內容，Structure／結構查看欄位

可在 SQL 分頁執行下列唯讀查詢，觀察稿件與作者的關係

```sql
SELECT m.title, u.name AS author, m.status
FROM manuscripts AS m
JOIN users AS u ON u.id = m.author_id;
```

投稿與審查請透過網站操作，以套用角色、狀態及版本檢查

## 備份

選取 `software_mid_term` → Export／匯出 → Quick／快速 → SQL → Export／執行

匯出的 SQL 包含帳號驗證資料與稿件，請存放在自己的備份位置

資料由 XAMPP MariaDB 管理，預設實體位置為 `C:/xampp/mysql/data/software_mid_term`，請使用 SQL 匯出備份，不要直接修改資料目錄內的檔案

## 資料來源與雲端網站

2026-11-17 已將原 D1 的 3 個帳號、5 篇稿件及 0 筆審查紀錄複製到本機，保留原帳號密碼，登入工作階段不搬移

雲端網站與本機網站使用獨立的資料庫，不會自動同步

GitHub 保存程式與建表 SQL，實際資料和 `.env.local` 連線設定不會上傳

## 技術組成

前端使用 HTML、CSS 與 JavaScript，後端由 Node.js 提供 API，透過 mysql2 套件連線到 XAMPP 的 MariaDB

MariaDB 相容 MySQL 通訊協定，phpMyAdmin 提供圖形管理介面，PHP 在此用來執行 phpMyAdmin

網站使用獨立的資料庫應用帳號，僅有專案資料庫的讀寫權限，XAMPP 原有 root 設定未變更

啟動器使用專案 `data/httpd-local.conf`，在 8080 提供本機 phpMyAdmin，不會覆寫 XAMPP 原始 Apache 設定

## 在另一台 Windows 電腦設定

1. 安裝 Node.js 22.13 或更新版本、pnpm 與 XAMPP
2. 下載專案後執行 `pnpm install --frozen-lockfile`
3. 在 XAMPP 啟動 MySQL，預設連線位置為 `127.0.0.1:3306`
4. 執行 `pnpm db:init:mysql`，建立資料庫及專用應用帳號，自動產生 `.env.local`
5. 執行 `pnpm start` 或雙擊 `啟動本機網站.cmd`

若 XAMPP root 有密碼，初始化前在 PowerShell 設定 `$env:STUDIO_ADMIN_PASSWORD`，初始化完成後移除該環境變數

預設 XAMPP 路徑為 `C:/xampp`，不同安裝位置可透過 `XAMPP_ROOT` 指定

初始化只建立資料表與連線設定，不會複製這台電腦的帳號及稿件，在另一台電腦展示完整資料時，請從自己的 SQL 備份還原

`.env.example` 僅供欄位參考，不包含這台電腦的實際密碼，不需將它複製成 `.env.local` 再執行初始化

## 驗證指令

```sh
pnpm test
pnpm test:mysql
pnpm build
```

MySQL 整合測試需要本機 MariaDB 正在執行及既有示範編輯帳號，會建立獨立測試帳號與稿件並在結束後清理
