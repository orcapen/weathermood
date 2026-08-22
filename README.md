# 心晴日記

一個把即時天氣與心情一起保存的純前端 PWA。

## 功能

- 使用瀏覽器定位與 OpenWeatherMap 顯示目前天氣
- 記錄心情、備註與當下天氣，資料保存在瀏覽器 `localStorage`
- 首頁顯示當日紀錄，日記頁顯示所有卡片
- 依心情篩選，並可選日期區間匯出 UTF-8 CSV
- Service Worker 快取 App Shell，支援安裝與離線開啟

## 執行

PWA、定位與 Service Worker 需要安全來源，請勿直接以 `file://` 開啟。可在此目錄啟動靜態伺服器：

```powershell
uv run python -m http.server 8000
```

開啟 `http://localhost:8000` 後，首次使用請輸入 [OpenWeatherMap API key](https://openweathermap.org/api) 並允許瀏覽器取得位置。

## 資料與隱私

API key 與日記只保存在目前瀏覽器的 `localStorage`，不會傳送到自建後端；API key 僅用於直接呼叫 OpenWeatherMap。
