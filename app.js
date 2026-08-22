const STORAGE = {
  apiKey: "weathermood.apiKey",
  entries: "weathermood.entries",
};

const state = {
  apiKey: localStorage.getItem(STORAGE.apiKey) || "",
  weather: null,
  position: null,
  selectedMood: null,
  entries: readEntries(),
  dateRange: {
    start: "",
    end: "",
    appliedStart: "",
    appliedEnd: "",
    selecting: "start",
    viewDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  },
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const weatherSymbols = {
  Thunderstorm: "thunderstorm",
  Drizzle: "drizzle",
  Rain: "rain",
  Snow: "snow",
  Clear: "sun",
  Clouds: "cloud",
  Mist: "fog",
  Smoke: "fog",
  Haze: "fog",
  Dust: "fog",
  Fog: "fog",
  Sand: "fog",
  Ash: "fog",
  Squall: "wind",
  Tornado: "tornado",
};

function setWeatherSymbol(symbol, stateClass = "") {
  const element = $("#weatherSymbol");
  element.src = `assets/fluent-emoji/${symbol}.png`;
  element.className = `weather-symbol${stateClass ? ` ${stateClass}` : ""}`;
}

const weatherLabels = {
  "clear sky": "晴朗",
  "few clouds": "少雲",
  "scattered clouds": "多雲",
  "broken clouds": "多雲時陰",
  "overcast clouds": "陰天",
  "light rain": "小雨",
  "moderate rain": "中雨",
  "heavy intensity rain": "大雨",
};

const moodLabels = { 1: "低落", 2: "不好", 3: "平靜", 4: "不錯", 5: "開心" };
const legacyMoodScores = { 低落: 1, 不好: 2, 平靜: 3, 不錯: 4, 開心: 5 };

function moodScore(value) {
  const score = Number(value);
  return Number.isInteger(score) && score >= 1 && score <= 5 ? score : legacyMoodScores[value] || null;
}

function moodLabel(value) {
  return moodLabels[moodScore(value)] || "平靜";
}

document.addEventListener("DOMContentLoaded", init);

function init() {
  $("#todayDate").textContent = new Intl.DateTimeFormat("zh-TW", {
    month: "long", day: "numeric", weekday: "long",
  }).format(new Date());

  migrateStoredMoods();
  bindEvents();
  route();
  renderEntries();
  loadTodayEntry();
  registerServiceWorker();

  if (!state.apiKey) {
    $("#apiDialog").showModal();
  } else {
    requestLocationAndWeather();
  }
}

function bindEvents() {
  window.addEventListener("hashchange", route);
  $$(".mood-option").forEach((button) => button.addEventListener("click", () => chooseMood(button)));
  $("#noteInput").addEventListener("input", (event) => {
    $("#noteCount").textContent = `${event.target.value.length} / 200`;
  });
  $("#saveEntry").addEventListener("click", saveEntry);
  $("#refreshWeather").addEventListener("click", requestLocationAndWeather);
  $("#settingsButton").addEventListener("click", openApiDialog);
  $("#apiForm").addEventListener("submit", saveApiKey);
  $("#closeApiDialog").addEventListener("click", () => $("#apiDialog").close());
  $("#openExport").addEventListener("click", () => $("#exportDialog").showModal());
  $("#openImport").addEventListener("click", () => $("#importFile").click());
  $("#importFile").addEventListener("change", importData);
  $("#closeExportDialog").addEventListener("click", () => $("#exportDialog").close());
  $("#exportForm").addEventListener("submit", exportCsv);
  $("#moodFilter").addEventListener("change", renderHistory);
  $("#openDateRange").addEventListener("click", openDateRangePicker);
  $("#closeDateRange").addEventListener("click", () => $("#dateRangeDialog").close());
  $("#previousMonth").addEventListener("click", () => changeCalendarMonth(-1));
  $("#nextMonth").addEventListener("click", () => changeCalendarMonth(1));
  $("#calendarGrid").addEventListener("click", handleCalendarClick);
  $("#calendarGrid").addEventListener("keydown", handleCalendarKeydown);
  $("#restartDateRange").addEventListener("click", restartDateRange);
  $("#clearDateRange").addEventListener("click", clearDateRange);
  $("#confirmDateRange").addEventListener("click", confirmDateRange);
  $("#todayList").addEventListener("click", handleDelete);
  $("#historyList").addEventListener("click", handleDelete);
}

function route() {
  const view = location.hash === "#history" ? "history" : "home";
  $("#homeView").hidden = view !== "home";
  $("#historyView").hidden = view !== "history";
  $("#homeView").classList.toggle("active", view === "home");
  $("#historyView").classList.toggle("active", view === "history");
  $$(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === view));
  if (view === "history") renderHistory();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openApiDialog() {
  $("#apiKeyInput").value = state.apiKey;
  $("#apiError").textContent = "";
  $("#apiDialog").showModal();
}

function closeApiDialog() {
  if (!state.apiKey) {
    $("#apiError").textContent = "需要 API key 才能取得天氣。";
    return;
  }
  $("#apiDialog").close();
}

function saveApiKey(event) {
  event.preventDefault();
  const key = $("#apiKeyInput").value.trim();
  if (!key) {
    $("#apiError").textContent = "請輸入 API key。";
    return;
  }
  state.apiKey = key;
  localStorage.setItem(STORAGE.apiKey, key);
  $("#apiDialog").close();
  requestLocationAndWeather();
}

function requestLocationAndWeather() {
  setWeatherLoading();
  if (!navigator.geolocation) {
    showWeatherError("此瀏覽器不支援定位，無法使用天氣功能。");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      state.position = { latitude: coords.latitude, longitude: coords.longitude };
      fetchWeather(coords.latitude, coords.longitude);
    },
    (error) => {
      const message = error.code === 1
        ? "需要位置權限才能使用。請在瀏覽器設定中允許定位後重試。"
        : "目前無法取得位置，請稍後再試。";
      showWeatherError(message);
    },
    { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 },
  );
}

async function fetchWeather(latitude, longitude) {
  const params = new URLSearchParams({
    lat: latitude,
    lon: longitude,
    appid: state.apiKey,
    units: "metric",
    lang: "zh_tw",
  });

  try {
    const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?${params}`);
    if (!response.ok) {
      if (response.status === 401) throw new Error("API key 無效或尚未啟用，請重新設定。");
      throw new Error("天氣服務暫時無法回應，請稍後再試。");
    }
    const data = await response.json();
    state.weather = {
      location: data.name || "目前位置",
      temperature: Math.round(data.main.temp),
      feelsLike: Math.round(data.main.feels_like),
      humidity: data.main.humidity,
      pressure: data.main.pressure,
      condition: data.weather[0]?.main || "Clouds",
      description: data.weather[0]?.description || "",
    };
    renderWeather();
  } catch (error) {
    showWeatherError(error.message);
  }
}

function setWeatherLoading() {
  setEntryAvailability(false);
  $("#locationName").textContent = "正在取得位置…";
  $("#weatherDescription").textContent = "正在讀取天氣";
  setWeatherSymbol("cloud", "is-loading");
  $("#refreshWeather").disabled = true;
}

function renderWeather() {
  const weather = state.weather;
  $("#locationName").textContent = weather.location;
  $("#temperature").textContent = weather.temperature;
  $("#feelsLike").textContent = `${weather.feelsLike}°`;
  $("#humidity").textContent = `${weather.humidity}%`;
  $("#pressure").textContent = `${weather.pressure} hPa`;
  $("#weatherDescription").textContent = weatherLabels[weather.description] || weather.description;
  setWeatherSymbol(weatherSymbols[weather.condition] || "cloud");
  $("#refreshWeather").disabled = false;
  setEntryAvailability(true);
}

function showWeatherError(message) {
  state.weather = null;
  $("#locationName").textContent = "無法取得天氣";
  $("#temperature").textContent = "--";
  $("#weatherDescription").textContent = message;
  setWeatherSymbol("cloud", "is-error");
  $("#refreshWeather").disabled = false;
  setEntryAvailability(false);
  showToast(message);
}

function setEntryAvailability(available) {
  $$(".mood-option").forEach((option) => { option.disabled = !available; });
  $("#noteInput").disabled = !available;
  $("#noteInput").placeholder = available
    ? "（選填）今天的心情想說些什麼？"
    : "取得位置與天氣後即可開始記錄。";
  $("#saveEntry").disabled = !available || !state.selectedMood;
}

function chooseMood(button) {
  if (!state.weather) return;
  state.selectedMood = { mood: Number(button.dataset.mood), emoji: button.dataset.emoji };
  $$(".mood-option").forEach((option) => {
    option.setAttribute("aria-checked", String(option === button));
  });
  $("#saveEntry").disabled = !state.weather;
}

function saveEntry() {
  if (!state.selectedMood || !state.weather) return;
  const now = new Date();
  const localDate = toLocalDate(now);
  const existingIndex = state.entries.findIndex((item) => item.localDate === localDate);
  const existingEntry = existingIndex === -1 ? null : state.entries[existingIndex];
  const entry = {
    id: existingEntry?.id || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`),
    createdAt: existingEntry?.createdAt || localDate,
    updatedAt: localDate,
    localDate,
    mood: state.selectedMood.mood,
    emoji: state.selectedMood.emoji,
    note: $("#noteInput").value.trim(),
    weather: state.weather ? { ...state.weather } : null,
  };
  if (existingIndex === -1) {
    state.entries.unshift(entry);
  } else {
    state.entries = state.entries.filter((item) => item.localDate !== localDate);
    state.entries.unshift(entry);
  }
  persistEntries();
  renderEntries();
  updateSaveButton(true);
  showToast(existingEntry ? "今天的日記已更新" : "今天的日記已儲存");
  $("#todaySection").scrollIntoView({ behavior: "smooth", block: "start" });
}

function migrateStoredMoods() {
  let changed = false;
  state.entries = state.entries.map((entry) => {
    const mood = moodScore(entry.mood);
    if (!mood) return entry;
    const emoji = $(`.mood-option[data-mood="${mood}"]`)?.dataset.emoji || entry.emoji;
    if (entry.mood === mood && entry.emoji === emoji) return entry;
    changed = true;
    return { ...entry, mood, emoji };
  });
  if (changed) persistEntries();
}

function getTodayEntry() {
  const today = toLocalDate(new Date());
  return state.entries.find((entry) => entry.localDate === today) || null;
}

function loadTodayEntry() {
  const entry = getTodayEntry();
  if (!entry) {
    updateSaveButton(false);
    return;
  }

  state.selectedMood = { mood: moodScore(entry.mood), emoji: entry.emoji };
  $$(".mood-option").forEach((option) => {
    option.setAttribute("aria-checked", String(Number(option.dataset.mood) === moodScore(entry.mood)));
  });
  $("#noteInput").value = entry.note || "";
  $("#noteCount").textContent = `${$("#noteInput").value.length} / 200`;
  $("#saveEntry").disabled = !state.weather;
  updateSaveButton(true);
}

function updateSaveButton(isUpdate) {
  const label = $("#saveEntry span:first-child");
  if (label) label.textContent = isUpdate ? "更新今天的日記" : "儲存今天的日記";
}

function readEntries() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE.entries) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function persistEntries() {
  localStorage.setItem(STORAGE.entries, JSON.stringify(state.entries));
}

function renderEntries() {
  const today = toLocalDate(new Date());
  const entries = state.entries.filter((entry) => entry.localDate === today);
  $("#todaySection").hidden = entries.length === 0;
  $("#todayCount").textContent = `${entries.length} 則`;
  $("#todayList").innerHTML = entries.map(entryCard).join("");
  renderHistory();
}

function renderHistory() {
  const filter = $("#moodFilter")?.value || "all";
  const { appliedStart, appliedEnd } = state.dateRange;
  const entries = state.entries.filter((entry) =>
    (filter === "all" || moodLabel(entry.mood) === filter)
    && (!appliedStart || entry.localDate >= appliedStart)
    && (!appliedEnd || entry.localDate <= appliedEnd));
  $("#emptyHistory").hidden = state.entries.length !== 0;
  $("#historyList").hidden = state.entries.length === 0;
  $("#historyList").innerHTML = entries.length
    ? entries.map(entryCard).join("")
    : '<div class="empty-state"><span>◌</span><h2>沒有符合的紀錄</h2><p>試著調整心情或日期篩選。</p></div>';
  $("#historySummary").textContent = state.entries.length
    ? `你已收藏 ${state.entries.length} 份心情天氣。`
    : "每一天，都是值得收藏的天氣。";
}

function openDateRangePicker() {
  const anchor = state.dateRange.start || state.dateRange.appliedStart || toLocalDate(new Date());
  state.dateRange.viewDate = parseLocalDate(anchor);
  state.dateRange.viewDate.setDate(1);
  renderDateRangePicker();
  $("#dateRangeDialog").showModal();
  requestAnimationFrame(() => {
    const selected = $(".calendar-day.range-start") || $(".calendar-day.today") || $(".calendar-day");
    selected?.focus();
  });
}

function renderDateRangePicker(focusDate = "") {
  const { start, end, selecting, viewDate } = state.dateRange;
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = toLocalDate(new Date());
  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  const activeFocus = focusDate.startsWith(monthPrefix) ? focusDate
    : start.startsWith(monthPrefix) ? start
      : today.startsWith(monthPrefix) ? today
        : `${monthPrefix}-01`;

  $("#calendarMonth").textContent = `${year} 年 ${month + 1} 月`;
  const days = Array.from({ length: daysInMonth }, (_, index) => {
    const date = toLocalDate(new Date(year, month, index + 1));
    const classes = ["calendar-day"];
    if (start && end && start <= end && date > start && date < end) classes.push("in-range");
    if (date === start) classes.push("range-start");
    if (date === end) classes.push("range-end");
    if (date === today) classes.push("today");
    const selected = date === start || date === end;
    return `<button class="${classes.join(" ")}" type="button" role="gridcell" data-date="${date}" tabindex="${date === activeFocus ? "0" : "-1"}" aria-label="${formatLongDate(date)}" aria-selected="${selected}">${index + 1}</button>`;
  }).join("");
  $("#calendarGrid").innerHTML = `${'<span class="calendar-spacer" aria-hidden="true"></span>'.repeat(firstWeekday)}${days}`;

  $("#datePickerInstruction").textContent = selecting === "start"
    ? "請先選擇開始日。"
    : selecting === "end" ? "接著選擇結束日。" : "日期區間已選定，按下確認即可套用。";
  $("#confirmDateRange").disabled = !start || !end || end < start;
  updateDateSelection();
}

function handleCalendarClick(event) {
  const button = event.target.closest("[data-date]");
  if (!button) return;
  selectRangeDate(button.dataset.date);
}

function selectRangeDate(date) {
  const range = state.dateRange;
  if (range.selecting === "start" || range.selecting === "complete") {
    range.start = date;
    range.end = "";
    range.selecting = "end";
    $("#datePickerError").textContent = "";
  } else {
    range.end = date;
    if (range.end < range.start) {
      $("#datePickerError").textContent = "結束日不可早於開始日，請重新選擇結束日。";
    } else {
      range.selecting = "complete";
      $("#datePickerError").textContent = "";
    }
  }
  renderDateRangePicker(date);
  $( `[data-date="${date}"]` )?.focus();
}

function updateDateSelection() {
  const { start, end } = state.dateRange;
  if (!start) {
    $("#dateSelection").innerHTML = "尚未選擇日期。";
    return;
  }
  const duration = end && end >= start ? inclusiveDays(start, end) : 0;
  $("#dateSelection").innerHTML = `<strong>${formatShortDate(start)} → ${end ? formatShortDate(end) : "請選擇結束日"}</strong>${duration ? `共 ${duration} 天（包含開始與結束日）` : ""}`;
}

function updateAppliedDateRange() {
  const { appliedStart, appliedEnd } = state.dateRange;
  if (!appliedStart || !appliedEnd) {
    $("#dateRangeLabel").textContent = "選擇日期區間";
    $("#dateRangeSummary").textContent = "";
    return;
  }
  const duration = inclusiveDays(appliedStart, appliedEnd);
  $("#dateRangeLabel").textContent = `${formatShortDate(appliedStart)} – ${formatShortDate(appliedEnd)}`;
  $("#dateRangeSummary").textContent = `開始 ${formatLongDate(appliedStart)}・結束 ${formatLongDate(appliedEnd)}・共 ${duration} 天`;
}

function restartDateRange() {
  state.dateRange.start = "";
  state.dateRange.end = "";
  state.dateRange.selecting = "start";
  state.dateRange.viewDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  $("#datePickerError").textContent = "";
  renderDateRangePicker();
  $(".calendar-day.today")?.focus();
}

function clearDateRange() {
  restartDateRange();
  state.dateRange.appliedStart = "";
  state.dateRange.appliedEnd = "";
  updateAppliedDateRange();
  renderHistory();
}

function confirmDateRange() {
  const range = state.dateRange;
  if (!range.start || !range.end || range.end < range.start) return;
  range.appliedStart = range.start;
  range.appliedEnd = range.end;
  updateAppliedDateRange();
  renderHistory();
  $("#dateRangeDialog").close();
  $("#openDateRange").focus();
}

function changeCalendarMonth(offset, focusDay = 1) {
  const current = state.dateRange.viewDate;
  state.dateRange.viewDate = new Date(current.getFullYear(), current.getMonth() + offset, 1);
  const maxDay = new Date(state.dateRange.viewDate.getFullYear(), state.dateRange.viewDate.getMonth() + 1, 0).getDate();
  const focusDate = toLocalDate(new Date(state.dateRange.viewDate.getFullYear(), state.dateRange.viewDate.getMonth(), Math.min(focusDay, maxDay)));
  renderDateRangePicker(focusDate);
  requestAnimationFrame(() => $( `[data-date="${focusDate}"]` )?.focus());
}

function handleCalendarKeydown(event) {
  const button = event.target.closest("[data-date]");
  if (!button) return;
  const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
  let target;
  if (event.key in offsets) {
    target = parseLocalDate(button.dataset.date);
    target.setDate(target.getDate() + offsets[event.key]);
  } else if (event.key === "Home" || event.key === "End") {
    target = parseLocalDate(button.dataset.date);
    target.setDate(target.getDate() + (event.key === "Home" ? -target.getDay() : 6 - target.getDay()));
  } else if (event.key === "PageUp" || event.key === "PageDown") {
    event.preventDefault();
    changeCalendarMonth(event.key === "PageUp" ? -1 : 1, parseLocalDate(button.dataset.date).getDate());
    return;
  } else {
    return;
  }
  event.preventDefault();
  const targetDate = toLocalDate(target);
  if (target.getMonth() !== state.dateRange.viewDate.getMonth() || target.getFullYear() !== state.dateRange.viewDate.getFullYear()) {
    state.dateRange.viewDate = new Date(target.getFullYear(), target.getMonth(), 1);
    renderDateRangePicker(targetDate);
  }
  document.querySelectorAll(".calendar-day").forEach((day) => { day.tabIndex = day.dataset.date === targetDate ? 0 : -1; });
  $( `[data-date="${targetDate}"]` )?.focus();
}

function parseLocalDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function inclusiveDays(start, end) {
  const milliseconds = parseLocalDate(end) - parseLocalDate(start);
  return Math.round(milliseconds / 86400000) + 1;
}

function formatShortDate(value) {
  return new Intl.DateTimeFormat("zh-TW", { month: "numeric", day: "numeric" }).format(parseLocalDate(value));
}

function formatLongDate(value) {
  return new Intl.DateTimeFormat("zh-TW", { year: "numeric", month: "long", day: "numeric" }).format(parseLocalDate(value));
}

function entryCard(entry) {
  const date = new Date(entry.createdAt);
  const weather = entry.weather;
  const weatherText = weather
    ? `${escapeHtml(weather.location)} · ${weather.temperature}°C · ${escapeHtml(weatherLabels[weather.description] || weather.description)}`
    : "未記錄天氣";
  const note = entry.note ? escapeHtml(entry.note) : "沒有留下備註";
  const dateText = new Intl.DateTimeFormat("zh-TW", { month: "short", day: "numeric", weekday: "short" }).format(date);
  return `<article class="entry-card">
    <div class="entry-emoji" aria-hidden="true">${entry.emoji}</div>
    <div><h3>${moodLabel(entry.mood)} · ${weatherText}</h3><p>${note}</p></div>
    <div class="entry-meta"><div>${dateText}</div><button class="delete-button" type="button" data-delete-id="${entry.id}">刪除</button></div>
  </article>`;
}

function handleDelete(event) {
  const button = event.target.closest("[data-delete-id]");
  if (!button) return;
  if (!window.confirm("確定要刪除這則日記嗎？")) return;
  state.entries = state.entries.filter((entry) => entry.id !== button.dataset.deleteId);
  persistEntries();
  renderEntries();
  showToast("日記已刪除");
}

function exportCsv(event) {
  event.preventDefault();
  const format = event.submitter?.value || "csv";
  const start = $("#exportStart").value;
  const end = $("#exportEnd").value;
  $("#exportError").textContent = "";
  if (start && end && start > end) {
    $("#exportError").textContent = "開始日期不可晚於結束日期。";
    return;
  }
  const entries = state.entries.filter((entry) => (!start || entry.localDate >= start) && (!end || entry.localDate <= end));
  if (!entries.length) {
    $("#exportError").textContent = "此日期區間沒有可匯出的紀錄。";
    return;
  }
  if (format === "json") {
    downloadFile(
      JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), entries }, null, 2),
      `心晴日記_${start || "全部"}_${end || "全部"}.json`,
      "application/json;charset=utf-8",
    );
    $("#exportDialog").close();
    showToast(`已匯出 ${entries.length} 則 JSON 日記`);
    return;
  }
  const header = ["日期", "心情", "備註", "地點", "溫度°C", "體感°C", "濕度%", "氣壓hPa", "天氣"];
  const rows = entries.map((entry) => {
    const weather = entry.weather || {};
    return [entry.localDate, entry.mood, entry.note, weather.location, weather.temperature, weather.feelsLike, weather.humidity, weather.pressure, weather.description];
  });
  const csv = `\uFEFF${[header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
  downloadFile(csv, `心晴日記_${start || "全部"}_${end || "全部"}.csv`, "text/csv;charset=utf-8");
  $("#exportDialog").close();
  showToast(`已匯出 ${entries.length} 則 CSV 日記`);
}

function downloadFile(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function importData(event) {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;
  try {
    const text = (await file.text()).replace(/^\uFEFF/, "");
    const rawEntries = file.name.toLowerCase().endsWith(".json")
      ? parseJsonEntries(text)
      : parseCsvEntries(text);
    const entries = rawEntries.map(normalizeImportedEntry).filter(Boolean);
    if (!entries.length) throw new Error("檔案中沒有可匯入的日記資料");
    state.entries = [...entries, ...state.entries].sort((a, b) => b.localDate.localeCompare(a.localDate));
    persistEntries();
    renderEntries();
    loadTodayEntry();
    showToast(`已匯入 ${entries.length} 則日記`);
  } catch (error) {
    showToast(`匯入失敗：${error.message}`);
  }
}

function parseJsonEntries(text) {
  const data = JSON.parse(text);
  const entries = Array.isArray(data) ? data : data?.entries;
  if (!Array.isArray(entries)) throw new Error("JSON 中找不到 entries 陣列");
  return entries;
}

function parseCsvEntries(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const headers = rows[0].map((value) => value.trim().toLowerCase());
  const find = (...names) => headers.findIndex((header) => names.includes(header));
  const indexes = {
    localDate: find("日期", "date", "localdate"), mood: find("心情", "mood"), note: find("備註", "筆記", "note"),
    location: find("地點", "location"), temperature: find("溫度°c", "temperature"), feelsLike: find("體感°c", "feelslike"),
    humidity: find("濕度%", "humidity"), pressure: find("氣壓hpa", "pressure"), description: find("天氣", "description"),
  };
  return rows.slice(1).filter((row) => row.some((cell) => cell.trim())).map((row) => {
    const value = (key, fallback) => row[indexes[key] >= 0 ? indexes[key] : fallback] ?? "";
    return { localDate: value("localDate", 0), mood: value("mood", 1), note: value("note", 2), weather: {
      location: value("location", 3), temperature: value("temperature", 4), feelsLike: value("feelsLike", 5),
      humidity: value("humidity", 6), pressure: value("pressure", 7), description: value("description", 8),
    } };
  });
}

function parseCsv(text) {
  const rows = []; let row = []; let cell = ""; let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted && char === '"' && text[index + 1] === '"') { cell += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  if (quoted) throw new Error("CSV 引號格式不正確");
  return rows;
}

function normalizeImportedEntry(entry) {
  const localDate = String(entry?.localDate || entry?.date || "").slice(0, 10);
  const mood = moodScore(String(entry?.mood || "").trim());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate) || !mood) return null;
  const moodButton = $$(".mood-option").find((button) => Number(button.dataset.mood) === mood);
  const hasWeather = entry.weather && Object.values(entry.weather).some((value) => value !== "");
  const weather = hasWeather ? { ...entry.weather,
    temperature: numberOrValue(entry.weather.temperature), feelsLike: numberOrValue(entry.weather.feelsLike),
    humidity: numberOrValue(entry.weather.humidity), pressure: numberOrValue(entry.weather.pressure),
  } : null;
  return {
    id: String(entry.id || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`)),
    createdAt: entry.createdAt || localDate, updatedAt: entry.updatedAt || localDate, localDate, mood,
    emoji: entry.emoji || moodButton?.dataset.emoji || "🙂", note: String(entry.note || "").slice(0, 200), weather,
  };
}

function numberOrValue(value) {
  return value !== "" && Number.isFinite(Number(value)) ? Number(value) : value;
}

function csvCell(value) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function toLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]);
}

let toastTimer;
function showToast(message) {
  clearTimeout(toastTimer);
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 3200);
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // The app remains usable if service worker registration is unavailable.
    });
  }
}
