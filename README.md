# 心晴日記

一個把即時天氣與心情一起保存的純前端 PWA。

## 功能

- 使用瀏覽器定位與 [Open-Meteo](https://open-meteo.com/) 顯示目前天氣，不需 API key
- 記錄心情、備註、座標與當下天氣，資料保存在瀏覽器 `localStorage`
- 一天保留一筆紀錄，同日再次儲存會更新原本內容
- 首頁顯示當日紀錄，日記頁顯示所有卡片
- 依心情篩選，並可選日期區間匯出 UTF-8 CSV 或 JSON
- 使用 Google Identity Services 將可見的 JSON 備份匯出至 Google Drive，或從 Drive 匯入
- Service Worker 快取 App Shell，支援安裝與離線開啟

## 執行

PWA、定位與 Service Worker 需要安全來源，請勿直接以 `file://` 開啟。可在此目錄啟動靜態伺服器：

```powershell
uv run python -m http.server 5500
```

開啟 `http://localhost:5500` 後，允許瀏覽器取得位置即可使用。緯度與經度會用來查詢當下天氣並保存於日記，匯出 CSV、JSON 或備份至 Google Drive 時也會包含座標；應用程式不會解析或顯示地名。

## 匯出檔案存放位置

匯出 CSV 或 JSON 時，應用程式是以瀏覽器的一般下載流程產生檔案，**不會**自行選擇資料夾，因此檔案會存到「你目前瀏覽器設定的下載位置」：

| 平台 | 預設位置 |
| --- | --- |
| Windows | `C:\Users\<使用者名稱>\Downloads` |
| macOS | `/Users/<使用者名稱>/Downloads` |
| Android（Chrome） | 內部儲存空間的 `Download` 資料夾，可用「檔案」App 開啟 |
| iOS（Safari） | 「檔案」App →「我的 iPhone/iPad」→ `下載項目`（可在 Safari 設定改為 iCloud 雲碟） |

若瀏覽器有開啟「每次下載都詢問儲存位置」，則會跳出對話框由你自行指定資料夾。下載完成後也可從瀏覽器的下載清單（Chrome/Edge 為 `Ctrl+J`）點選「顯示於資料夾」直接定位檔案。

檔名格式如下，其中日期為匯出時所選的區間，未選則為「全部」：

- `心晴日記_<開始日期>_<結束日期>.csv`
- `心晴日記_<開始日期>_<結束日期>.json`

例如 `心晴日記_2026-08-01_2026-08-24.csv`、`心晴日記_全部_全部.json`。

選擇匯出到 Google Drive 時則不會下載到本機，檔案會直接寫入雲端硬碟，位置與檔名請見下一節。

## Google Drive 備份

Google Drive 功能使用純前端的 Google Identity Services token model，不使用 Client Secret。OAuth access token 只會暫存在頁面記憶體中，不會寫入 `localStorage`。

Google Cloud 專案需完成以下設定：

1. 啟用 `Google Drive API`。
2. 建立「網頁應用程式」OAuth 用戶端。
3. 加入已授權的 JavaScript 來源：`http://localhost:5500`、`http://127.0.0.1:5500` 與 `https://mood.aspieorca.org`。
4. 不需設定重新導向 URI。
5. 在 OAuth 資料存取權加入非機密範圍 `https://www.googleapis.com/auth/drive.file`。

應用程式會在「我的雲端硬碟」建立並重用可見的 `心晴日記備份` 資料夾。備份會以 `心晴日記備份_YYYY-MM-DD_HH-mm-ss.json` 儲存在其中，因此使用者可直接看到、下載或刪除。匯入清單只顯示由此應用程式建立的備份；舊版曾建立在根目錄的備份仍可匯入。

## 一天一筆紀錄

心晴日記以「當地日期」為索引，**同一天只會保留一筆紀錄**：

- 今天已存過之後，再按一次儲存不會新增第二筆，而是更新原本那筆（按鈕文字也會變成「更新今天的日記」）。
- 重新開啟頁面時，今天那筆的心情與備註會自動回填到輸入欄，所以輸入欄不是空的、且儲存後文字仍留著，都是預期行為。今天還沒過完，心情可能會變，隨時都能回來修改。
- 想保留同一天的多個版本，請先匯出 CSV/JSON 備份，再修改當天的內容。

## 資料與隱私

日記只保存在目前瀏覽器的 `localStorage`，不會傳送到自建後端。瀏覽器取得的緯度與經度會直接傳送至 Open-Meteo 查詢天氣，並與當下天氣一起寫入日記；匯出 CSV、JSON 或備份至 Google Drive 時也會包含座標。

天氣資料由 [Open-Meteo](https://open-meteo.com/) 提供。

## 授權

本專案採用 [MIT License](LICENSE) 授權。原始碼位於 [GitHub](https://github.com/orcapen/weathermood)。
