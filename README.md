# 心晴日記

一個把即時天氣與心情一起保存的純前端 PWA。

## 功能

- 使用瀏覽器定位與 OpenWeatherMap 顯示目前天氣
- 記錄心情、備註與當下天氣，資料保存在瀏覽器 `localStorage`
- 首頁顯示當日紀錄，日記頁顯示所有卡片
- 依心情篩選，並可選日期區間匯出 UTF-8 CSV 或 JSON
- 使用 Google Identity Services 將可見的 JSON 備份匯出至 Google Drive，或從 Drive 匯入
- Service Worker 快取 App Shell，支援安裝與離線開啟

## 執行

PWA、定位與 Service Worker 需要安全來源，請勿直接以 `file://` 開啟。可在此目錄啟動靜態伺服器：

```powershell
uv run python -m http.server 5500
```

開啟 `http://localhost:5500` 後，首次使用請輸入 [OpenWeatherMap API key](https://openweathermap.org/api) 並允許瀏覽器取得位置。

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

API key 與日記只保存在目前瀏覽器的 `localStorage`，不會傳送到自建後端；API key 僅用於直接呼叫 OpenWeatherMap。

## 授權

本專案採用 [MIT License](LICENSE) 授權。原始碼位於 [GitHub](https://github.com/orcapen/weathermood)。
