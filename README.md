# WeatherMood 天氣心情誌

一個零相依的 PWA，使用 OpenWeatherMap 取得目前氣溫、氣壓、濕度、天氣與雲量，並以五點量表記錄心情。所有設定與日記資料都保存在瀏覽器 `localStorage`。

## 啟動

PWA 與定位功能需要從 `localhost` 或 HTTPS 提供，不能直接開啟 HTML 檔案。

```powershell
uvx --from httpie http --help
uv run python -m http.server 8000
```

若專案沒有 Python 環境，也可以使用任何靜態檔案伺服器。開啟 `http://localhost:8000` 後：

1. 在 [OpenWeatherMap](https://openweathermap.org/api) 建立 API key。
2. 點右上角設定圖示並貼上 key。
3. 使用定位或搜尋城市取得天氣，再選擇心情並儲存。

> OpenWeatherMap 的新 key 可能需要一段時間才會啟用。此專案是純前端應用，API key 雖只儲存在本機，仍會出現在瀏覽器的網路請求中；公開部署時建議用後端代理 API。

## 資料與離線

- API key、上次查詢位置與心情紀錄存於目前瀏覽器的 `localStorage`。
- 可從「最近紀錄」匯出帶有 UTF-8 BOM 的 CSV，方便以 Excel 或試算表開啟。
- Service Worker 會快取應用程式外殼，離線時仍可查看及新增紀錄。
- 離線時無法更新即時天氣；未取得天氣時新增的紀錄會標示「未記錄天氣」。
