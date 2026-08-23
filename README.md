# 心晴日記

一個把即時天氣與心情一起保存的 Cloudflare Pages PWA。瀏覽器只呼叫本站的 Pages Function，OpenWeatherMap API key 不會進入前端程式或瀏覽器儲存空間。

## 功能

- 使用瀏覽器定位，透過 `/api/weather` 顯示 OpenWeatherMap 目前天氣
- 記錄心情、備註與當下天氣，資料保存在瀏覽器 `localStorage`
- 首頁顯示當日紀錄，日記頁顯示所有卡片
- 依心情篩選，並可選日期區間匯出 UTF-8 CSV 或 JSON
- 使用 Google Identity Services 將可見的 JSON 備份匯出至 Google Drive，或從 Drive 匯入
- Service Worker 快取 App Shell，支援安裝與離線開啟

## 架構

```text
PWA Frontend → /api/weather → Cloudflare Pages Function → OpenWeatherMap
```

`functions/api/weather.js` 只接受 `lat` 與 `lon`，並固定呼叫 OpenWeatherMap Current Weather endpoint。API key 由 server-side `WEATHER_API_KEY` binding 讀取；Function 只回傳前端需要的地點、溫度、體感、濕度、氣壓與天氣描述。

## 本機執行

PWA、定位與 Service Worker 需要安全來源，請勿直接以 `file://` 開啟。先建立本機 secret 檔案：

```powershell
Copy-Item .dev.vars.example .dev.vars
```

將 `.dev.vars` 的 `WEATHER_API_KEY` 換成有效的 [OpenWeatherMap API key](https://openweathermap.org/api)，再從專案根目錄啟動 Pages 本機環境：

```powershell
npx.cmd wrangler@latest pages dev . --port 5500
```

開啟 `http://localhost:5500` 並允許瀏覽器取得位置。沿用 `5500` 可維持下方既有的 Google OAuth authorized origin。可另外檢查成功與參數驗證：

```powershell
curl.exe -i "http://localhost:5500/api/weather?lat=24.8&lon=120.9"
curl.exe -i "http://localhost:5500/api/weather"
```

原本的 `uv run python -m http.server 5500` 仍可用於純靜態與離線介面 smoke test，但不會執行 `/api/weather`。

## Cloudflare Pages 設定

保留既有 Pages 的 Root directory 與 Build output directory，不需新增 Express、獨立 Worker 或額外伺服器。此 repo 沒有 build tool；若 Git integration 的 Build command 目前為空白，請設為 `exit 0`，讓 Pages 執行 Functions build。若已有有效的自訂 build command，則保留原值。

到 Cloudflare Dashboard 的 **Workers & Pages → 此專案 → Settings → Variables and Secrets** 新增：

- 名稱：`WEATHER_API_KEY`
- 值：有效的 OpenWeatherMap API key
- 類型：選擇 **Encrypt**（Secret）

Production environment 必須設定；若 Preview deployment 也要使用天氣功能，Preview environment 需另外設定同名 Secret。設定後重新部署，讓 binding 套用到新的 deployment。

此專案沒有 build tool，repo 根目錄就是靜態輸出。`functions/api/weather.js` 會由 Pages 的 Git integration 編譯為 `/api/weather`。若現有專案採 Dashboard drag-and-drop Direct Upload，請改用 Wrangler 對同一個 Pages project 發布；drag-and-drop 不會編譯 `functions/`，而 Direct Upload project 也不能直接切換成 Git integration：

```powershell
npx.cmd wrangler@latest pages deploy . --project-name=<既有 Pages 專案名稱>
```

部署後可測試：

```powershell
curl.exe -i "https://<你的網域>/api/weather?lat=24.8&lon=120.9"
curl.exe -i "https://<你的網域>/api/weather"
```

第一個請求應回傳天氣 JSON，第二個應回傳 `400` JSON。瀏覽器 DevTools 的 Network 只應看到本站 `/api/weather?lat=...&lon=...`，網址不得包含 `appid` 或 API key；Application → Cache Storage 也不應出現 `/api/` 項目。

若要驗證已安裝的舊版 PWA 升級，請在部署後開啟網站、等待新版 Service Worker 啟用，再重新整理一次；確認 `weathermood-v0.9.1` cache 已清除，且 Local Storage 不再有 `weathermood.apiKey`。這不會清除 `weathermood.entries` 日記資料。

## Google Drive 備份

Google Drive 功能使用純前端的 Google Identity Services token model，不使用 Client Secret。OAuth access token 只會暫存在頁面記憶體中，不會寫入 `localStorage`。

Google Cloud 專案需完成以下設定：

1. 啟用 `Google Drive API`。
2. 建立「網頁應用程式」OAuth 用戶端。
3. 加入已授權的 JavaScript 來源：`http://localhost:5500`、`http://127.0.0.1:5500` 與 `https://mood.aspieorca.org`。
4. 不需設定重新導向 URI。
5. 在 OAuth 資料存取權加入非機密範圍 `https://www.googleapis.com/auth/drive.file`。

應用程式會在「我的雲端硬碟」建立並重用可見的 `心晴日記備份` 資料夾。備份會以 `心晴日記備份_YYYY-MM-DD_HH-mm-ss.json` 儲存在其中，因此使用者可直接看到、下載或刪除。匯入清單只顯示由此應用程式建立的備份；舊版曾建立在根目錄的備份仍可匯入。

## 資料與隱私

日記仍只保存在目前瀏覽器的 `localStorage`；匯入、匯出與 Google Drive 備份流程不變。舊版曾保存的 `weathermood.apiKey` 會在新版啟動時自動移除。部署環境的 OpenWeatherMap API key 只存在 Cloudflare Secret；本機測試 key 只放在 Git 已忽略的 `.dev.vars`。Function 不會將 key 寫入 response 或 log。

## 授權

本專案採用 [MIT License](LICENSE) 授權。原始碼位於 [GitHub](https://github.com/orcapen/weathermood)。
