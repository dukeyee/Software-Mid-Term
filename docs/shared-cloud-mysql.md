# 共用雲端 MySQL

## 開啟方式

- 網站：https://submission-web-production.up.railway.app/
- 本機網站：http://127.0.0.1:4173/
- 資料庫管理：https://database-admin-production.up.railway.app/

網站使用奶龍、奶蛙、自由時報原有帳號，示範密碼仍為 demo123

phpMyAdmin 使用專用唯讀帳號，帳密保存在本機 `data/cloud-database-login.txt`，和網站登入帳號不同

進入 phpMyAdmin 後選擇 `software_mid_term`，點選各資料表即可查看，Export 可匯出 SQL 備份

本機網站需要網路連線，雙擊 `啟動本機網站.cmd` 啟動後，所有投稿、註冊及審查都會透過 HTTPS 存取同一份雲端資料

本機 `8080/phpmyadmin/` 已導向雲端管理頁，原 Sites 網址及 GitHub Pages 入口也導向新版網站

## login_attempts 驗證

1. 在網站輸入 nailong 及錯誤密碼
2. 在雲端 phpMyAdmin 點選 `login_attempts`
3. 點 Browse 或 Refresh 重新讀取，可看到失敗計數 `attempts`
4. 換成本機網站再輸入一次錯誤密碼，重新整理管理頁後，同一筆計數會增加

目前 API 對這兩個入口使用相同的帳號計數識別，故示範帳號的錯誤嘗試會共用計數

同一帳號成功登入後會清除對應計數，這張表不是永久登入歷史

15 分鐘內達 15 次失敗後會暫時阻擋，時間窗經過後，下一次錯誤嘗試重新計算

## 架構與資料保留

線上網站由 Railway Bun Function 執行共用 API，使用資料庫專用讀寫帳號連線

本機 Node.js 透過 HTTPS 將 API 請求轉送到同一個後端，保留本機登入 Cookie 及來源驗證

phpMyAdmin 使用官方映像與獨立 Apache 設定，必須輸入資料庫帳密，專用檢視帳號只有 SELECT 權限

MySQL 沒有對外公開 TCP 端點，後端和 phpMyAdmin 透過 Railway 私人網路存取

2026-11-17 比對原 D1 與本機資料無衝突後，搬入 3 個帳號、5 篇稿件、0 筆審查紀錄，登入工作階段與失敗計數不搬移

原 D1 與本機 MariaDB 保留切換前資料，後續操作不會回寫這兩份備份

## 部署來源

Railway 專案為 `Software-Mid-Term`，包含 MySQL、Submission-Web、Database-Admin

`node scripts/build-railway-function.mjs` 將共用 API、MySQL 介面與網頁打包為 `dist/railway-function.ts`，透過 Railway Function 發布

目前 Function 不會因 GitHub push 自動更新，需要重新建置後更新 Function 原始碼

phpMyAdmin 從 GitHub 的 `deploy/phpmyadmin/Dockerfile` 建置，目前固定在已驗證的提交，後續修改需明確更新服務來源提交

原 Sites Worker 在 `STUDIO_SHARED_SITE` 設定下提供導向，舊畫面未重新整理時的 API 請求會回傳 410，避免繼續寫入舊資料庫

本機 `.env.shared` 僅需 `STUDIO_SHARED_API`、`STUDIO_SHARED_ADMIN` 及私人 `STUDIO_PROXY_KEY`，這些設定不會上傳 GitHub

首次資料庫初始化需要臨時管理連線及匯入資料，完成後已停用初始化，並清空後端的臨時管理憑證與匯入內容

## 驗證與額度

```sh
node --test tests/shared-cloud.integration.cjs
```

測試跨入口新增、讀取、送出、退回、作者查看原因與來源驗證，測試自行建立的稿件會在結束後清理

已驗證線上錯誤登入使 `attempts` 變為 1，本機錯誤登入使同一筆紀錄變為 2

只使用 Railway 免費／試用額度，未開通付費方案，試用額度或期限用盡後網站可能停止，需要在管理頁查看剩餘額度，並先匯出需要保留的資料
