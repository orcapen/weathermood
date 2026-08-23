const STORAGE = {
  entries: "weathermood.entries",
};

const GOOGLE_CLIENT_ID = "918181579161-bkgjjebb00asi87i8p16lojja03u59h0.apps.googleusercontent.com";
const GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const GOOGLE_DRIVE_API = "https://www.googleapis.com/drive/v3";
const GOOGLE_DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
const GOOGLE_DRIVE_BACKUP_FOLDER = "心晴日記備份";
const WEATHER_REQUEST_TIMEOUT_MS = 12000;

const state = {
  weather: null,
  selectedMood: null,
  entries: readEntries(),
  dateRange: createDateRangeState(),
  exportDateRange: createDateRangeState(),
  dateRangeContext: "history",
  googleAccessToken: "",
  googleTokenExpiresAt: 0,
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

const weatherCodes = {
  0: { condition: "Clear", description: "晴朗" },
  1: { condition: "Clear", description: "晴時多雲" },
  2: { condition: "Clouds", description: "多雲" },
  3: { condition: "Clouds", description: "陰天" },
  45: { condition: "Fog", description: "霧" },
  48: { condition: "Fog", description: "霧淞" },
  51: { condition: "Drizzle", description: "小毛毛雨" },
  53: { condition: "Drizzle", description: "毛毛雨" },
  55: { condition: "Drizzle", description: "大毛毛雨" },
  56: { condition: "Drizzle", description: "小凍毛毛雨" },
  57: { condition: "Drizzle", description: "凍毛毛雨" },
  61: { condition: "Rain", description: "小雨" },
  63: { condition: "Rain", description: "中雨" },
  65: { condition: "Rain", description: "大雨" },
  66: { condition: "Rain", description: "小凍雨" },
  67: { condition: "Rain", description: "凍雨" },
  71: { condition: "Snow", description: "小雪" },
  73: { condition: "Snow", description: "中雪" },
  75: { condition: "Snow", description: "大雪" },
  77: { condition: "Snow", description: "雪粒" },
  80: { condition: "Rain", description: "小陣雨" },
  81: { condition: "Rain", description: "陣雨" },
  82: { condition: "Rain", description: "強陣雨" },
  85: { condition: "Snow", description: "小陣雪" },
  86: { condition: "Snow", description: "強陣雪" },
  95: { condition: "Thunderstorm", description: "雷雨" },
  96: { condition: "Thunderstorm", description: "雷雨伴隨小冰雹" },
  99: { condition: "Thunderstorm", description: "雷雨伴隨大冰雹" },
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
  localStorage.removeItem("weathermood.apiKey");
  requestLocationAndWeather();
}

function bindEvents() {
  window.addEventListener("hashchange", route);
  $$(".mood-option").forEach((button) => button.addEventListener("click", () => chooseMood(button)));
  $("#noteInput").addEventListener("input", (event) => {
    $("#noteCount").textContent = `${event.target.value.length} / 200`;
  });
  $("#saveEntry").addEventListener("click", saveEntry);
  $("#refreshWeather").addEventListener("click", requestLocationAndWeather);
  $("#openExport").addEventListener("click", () => $("#exportDialog").showModal());
  $("#openImport").addEventListener("click", () => $("#importDialog").showModal());
  $("#closeImportDialog").addEventListener("click", () => $("#importDialog").close());
  $("#importFromDevice").addEventListener("click", () => {
    $("#importDialog").close();
    $("#importFile").click();
  });
  $("#importFromDrive").addEventListener("click", openDriveBackups);
  $("#importFile").addEventListener("change", importData);
  $("#closeDriveBackupDialog").addEventListener("click", () => $("#driveBackupDialog").close());
  $("#refreshDriveBackups").addEventListener("click", loadDriveBackups);
  $("#driveBackupList").addEventListener("click", importDriveBackup);
  $("#closeExportDialog").addEventListener("click", () => $("#exportDialog").close());
  $("#exportForm").addEventListener("submit", exportData);
  $("#moodFilter").addEventListener("change", renderHistory);
  $("#openDateRange").addEventListener("click", () => openDateRangePicker("history"));
  $("#openExportDateRange").addEventListener("click", () => openDateRangePicker("export"));
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

function requestLocationAndWeather() {
  setWeatherLoading();
  if (!navigator.geolocation) {
    showWeatherError("此瀏覽器不支援定位，無法使用天氣功能。");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      fetchWeather(coords.latitude, coords.longitude);
    },
    (error) => {
      const message = error.code === 1
        ? "需要位置權限才能使用。請在瀏覽器設定中允許定位後重試。"
        : "目前無法取得位置，請稍後再試。";
      showWeatherError(message);
    },
    { enableHighAccuracy: false, timeout: WEATHER_REQUEST_TIMEOUT_MS, maximumAge: 300000 },
  );
}

async function fetchWeather(latitude, longitude) {
  const params = new URLSearchParams({
    latitude,
    longitude,
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,pressure_msl,weather_code",
  });
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), WEATHER_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal: controller.signal });
    if (!response.ok) {
      throw new Error("天氣服務暫時無法回應，請稍後再試。");
    }
    const data = await response.json();
    const current = data.current;
    const values = [
      current?.temperature_2m,
      current?.apparent_temperature,
      current?.relative_humidity_2m,
      current?.pressure_msl,
      current?.weather_code,
    ];
    if (!values.every(Number.isFinite)) {
      throw new Error("天氣資料格式不完整，請稍後再試。");
    }
    const weather = weatherCodes[current.weather_code] || {
      condition: "Clouds",
      description: "天氣狀況未知",
    };
    state.weather = {
      location: "",
      latitude,
      longitude,
      temperature: Math.round(current.temperature_2m),
      feelsLike: Math.round(current.apparent_temperature),
      humidity: current.relative_humidity_2m,
      pressure: Math.round(current.pressure_msl),
      condition: weather.condition,
      description: weather.description,
    };
    renderWeather();
  } catch (error) {
    const message = error.name === "AbortError"
      ? "天氣服務回應逾時，請稍後再試。"
      : error.message;
    showWeatherError(message);
  } finally {
    clearTimeout(timeoutId);
  }
}

function setWeatherLoading() {
  setEntryAvailability(false);
  $("#weatherDescription").textContent = "正在讀取天氣";
  setWeatherSymbol("cloud", "is-loading");
  $("#refreshWeather").disabled = true;
}

function renderWeather() {
  const weather = state.weather;
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
  $("#temperature").textContent = "--";
  $("#feelsLike").textContent = "--°";
  $("#humidity").textContent = "--%";
  $("#pressure").textContent = "---- hPa";
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

function createDateRangeState() {
  return {
    start: "", end: "", appliedStart: "", appliedEnd: "", selecting: "start",
    viewDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  };
}

function activeDateRange() {
  return state.dateRangeContext === "export" ? state.exportDateRange : state.dateRange;
}

function openDateRangePicker(context) {
  state.dateRangeContext = context;
  const range = activeDateRange();
  const anchor = range.start || range.appliedStart || toLocalDate(new Date());
  range.viewDate = parseLocalDate(anchor);
  range.viewDate.setDate(1);
  $("#dateRangeTitle").textContent = context === "export" ? "選擇匯出日期區間" : "選擇日期區間";
  renderDateRangePicker();
  $("#dateRangeDialog").showModal();
  requestAnimationFrame(() => {
    const selected = $(".calendar-day.range-start") || $(".calendar-day.today") || $(".calendar-day");
    selected?.focus();
  });
}

function renderDateRangePicker(focusDate = "") {
  const { start, end, selecting, viewDate } = activeDateRange();
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
  const range = activeDateRange();
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
  const { start, end } = activeDateRange();
  if (!start) {
    $("#dateSelection").innerHTML = "尚未選擇日期。";
    return;
  }
  const duration = end && end >= start ? inclusiveDays(start, end) : 0;
  $("#dateSelection").innerHTML = `<strong>${formatShortDate(start)} → ${end ? formatShortDate(end) : "請選擇結束日"}</strong>${duration ? `共 ${duration} 天（包含開始與結束日）` : ""}`;
}

function updateAppliedDateRange(context = state.dateRangeContext) {
  const range = context === "export" ? state.exportDateRange : state.dateRange;
  const { appliedStart, appliedEnd } = range;
  const label = context === "export" ? $("#exportDateRangeLabel") : $("#dateRangeLabel");
  const summary = context === "export" ? $("#exportDateRangeSummary") : $("#dateRangeSummary");
  if (!appliedStart || !appliedEnd) {
    label.textContent = context === "export" ? "全部日期" : "選擇日期區間";
    summary.textContent = context === "export" ? "未選擇區間時將匯出全部紀錄。" : "";
    return;
  }
  const duration = inclusiveDays(appliedStart, appliedEnd);
  label.textContent = `${formatShortDate(appliedStart)} – ${formatShortDate(appliedEnd)}`;
  summary.textContent = `開始 ${formatLongDate(appliedStart)}・結束 ${formatLongDate(appliedEnd)}・共 ${duration} 天`;
}

function restartDateRange() {
  const range = activeDateRange();
  range.start = "";
  range.end = "";
  range.selecting = "start";
  range.viewDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  $("#datePickerError").textContent = "";
  renderDateRangePicker();
  $(".calendar-day.today")?.focus();
}

function clearDateRange() {
  restartDateRange();
  const range = activeDateRange();
  range.appliedStart = "";
  range.appliedEnd = "";
  updateAppliedDateRange();
  if (state.dateRangeContext === "history") renderHistory();
}

function confirmDateRange() {
  const range = activeDateRange();
  if (!range.start || !range.end || range.end < range.start) return;
  range.appliedStart = range.start;
  range.appliedEnd = range.end;
  updateAppliedDateRange();
  if (state.dateRangeContext === "history") renderHistory();
  $("#dateRangeDialog").close();
  $(state.dateRangeContext === "export" ? "#openExportDateRange" : "#openDateRange").focus();
}

function changeCalendarMonth(offset, focusDay = 1) {
  const range = activeDateRange();
  const current = range.viewDate;
  range.viewDate = new Date(current.getFullYear(), current.getMonth() + offset, 1);
  const maxDay = new Date(range.viewDate.getFullYear(), range.viewDate.getMonth() + 1, 0).getDate();
  const focusDate = toLocalDate(new Date(range.viewDate.getFullYear(), range.viewDate.getMonth(), Math.min(focusDay, maxDay)));
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
  const range = activeDateRange();
  if (target.getMonth() !== range.viewDate.getMonth() || target.getFullYear() !== range.viewDate.getFullYear()) {
    range.viewDate = new Date(target.getFullYear(), target.getMonth(), 1);
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
  const weatherParts = weather ? [
    weather.temperature !== "" && weather.temperature != null ? `${escapeHtml(weather.temperature)}°C` : "",
    weather.description ? escapeHtml(weatherLabels[weather.description] || weather.description) : "",
  ].filter(Boolean) : [];
  const weatherText = weatherParts.join(" · ") || "未記錄天氣";
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

async function exportData(event) {
  event.preventDefault();
  const format = event.submitter?.value || "csv";
  const submitter = event.submitter;
  const { appliedStart: start, appliedEnd: end } = state.exportDateRange;
  $("#exportError").textContent = "";
  const entries = state.entries.filter((entry) => (!start || entry.localDate >= start) && (!end || entry.localDate <= end));
  if (!entries.length) {
    $("#exportError").textContent = "此日期區間沒有可匯出的紀錄。";
    return;
  }
  if (format === "drive") {
    submitter.disabled = true;
    submitter.setAttribute("aria-busy", "true");
    try {
      const file = await uploadDriveBackup(entries);
      $("#exportDialog").close();
      showToast(`已將 ${entries.length} 則日記儲存到 Google Drive：${file.name}`);
    } catch (error) {
      $("#exportError").textContent = error.message;
    } finally {
      submitter.disabled = false;
      submitter.removeAttribute("aria-busy");
    }
    return;
  }
  if (format === "json") {
    downloadFile(
      JSON.stringify(createBackup(entries), null, 2),
      `心晴日記_${start || "全部"}_${end || "全部"}.json`,
      "application/json;charset=utf-8",
    );
    $("#exportDialog").close();
    showToast(`已匯出 ${entries.length} 則 JSON 日記`);
    return;
  }
  const header = ["日期", "心情", "備註", "地點", "緯度", "經度", "溫度°C", "體感°C", "濕度%", "氣壓hPa", "天氣"];
  const rows = entries.map((entry) => {
    const weather = entry.weather || {};
    return [
      entry.localDate, entry.mood, entry.note, weather.location, weather.latitude, weather.longitude,
      weather.temperature, weather.feelsLike, weather.humidity, weather.pressure, weather.description,
    ];
  });
  const csv = `\uFEFF${[header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
  downloadFile(csv, `心晴日記_${start || "全部"}_${end || "全部"}.csv`, "text/csv;charset=utf-8");
  $("#exportDialog").close();
  showToast(`已匯出 ${entries.length} 則 CSV 日記`);
}

function createBackup(entries) {
  return { version: 1, exportedAt: new Date().toISOString(), entries };
}

function driveBackupFilename() {
  const now = new Date();
  const date = toLocalDate(now);
  const time = [now.getHours(), now.getMinutes(), now.getSeconds()]
    .map((value) => String(value).padStart(2, "0"))
    .join("-");
  return `心晴日記備份_${date}_${time}.json`;
}

async function requestDriveAccessToken() {
  if (state.googleAccessToken && state.googleTokenExpiresAt > Date.now() + 60_000) {
    return state.googleAccessToken;
  }

  const oauth = globalThis.google?.accounts?.oauth2;
  if (!oauth) throw new Error("Google 登入服務尚未載入，請確認網路連線後再試一次。");

  return new Promise((resolve, reject) => {
    const tokenClient = oauth.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: GOOGLE_DRIVE_SCOPE,
      callback: (response) => {
        if (response.error) {
          reject(new Error("Google 授權失敗，請重新選擇帳號並允許雲端硬碟權限。"));
          return;
        }
        if (!oauth.hasGrantedAllScopes(response, GOOGLE_DRIVE_SCOPE)) {
          reject(new Error("未授予 Google Drive 權限，無法存取備份。"));
          return;
        }
        state.googleAccessToken = response.access_token;
        state.googleTokenExpiresAt = Date.now() + Number(response.expires_in || 3600) * 1000;
        resolve(state.googleAccessToken);
      },
      error_callback: (error) => {
        const message = error.type === "popup_closed"
          ? "Google 登入視窗已關閉。"
          : "無法開啟 Google 登入視窗，請允許彈出式視窗後再試一次。";
        reject(new Error(message));
      },
    });
    tokenClient.requestAccessToken();
  });
}

async function driveRequest(url, options = {}) {
  const accessToken = await requestDriveAccessToken();
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    },
  });
  if (response.status === 401) {
    state.googleAccessToken = "";
    state.googleTokenExpiresAt = 0;
    throw new Error("Google 授權已過期，請再操作一次以重新登入。");
  }
  if (!response.ok) {
    let detail = "";
    try {
      const body = await response.json();
      detail = body?.error?.message || "";
    } catch {
      // Google API did not return a JSON error body.
    }
    throw new Error(detail ? `Google Drive 發生錯誤：${detail}` : `Google Drive 發生錯誤（${response.status}）。`);
  }
  return response;
}

async function uploadDriveBackup(entries) {
  const folder = await findDriveBackupFolder(true);
  const name = driveBackupFilename();
  const metadata = {
    name,
    mimeType: "application/json",
    description: "心晴日記 Google Drive 備份",
    appProperties: { app: "weathermood", formatVersion: "1" },
    parents: [folder.id],
  };
  const boundary = `weathermood_${crypto.randomUUID?.() || Date.now()}`;
  const content = JSON.stringify(createBackup(entries), null, 2);
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
    JSON.stringify(metadata),
    `\r\n--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
    content,
    `\r\n--${boundary}--`,
  ], { type: `multipart/related; boundary=${boundary}` });
  const response = await driveRequest(`${GOOGLE_DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,name,webViewLink,createdTime`, {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  return response.json();
}

async function findDriveBackupFolder(createIfMissing = false) {
  const parameters = new URLSearchParams({
    q: "trashed = false and mimeType = 'application/vnd.google-apps.folder' and appProperties has { key='app' and value='weathermood' } and appProperties has { key='type' and value='backupFolder' }",
    spaces: "drive",
    pageSize: "1",
    fields: "files(id,name)",
  });
  const response = await driveRequest(`${GOOGLE_DRIVE_API}/files?${parameters}`);
  const { files = [] } = await response.json();
  if (files[0]) return files[0];
  if (!createIfMissing) return null;

  const createResponse = await driveRequest(`${GOOGLE_DRIVE_API}/files?fields=id,name`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify({
      name: GOOGLE_DRIVE_BACKUP_FOLDER,
      mimeType: "application/vnd.google-apps.folder",
      description: "心晴日記的 Google Drive 備份資料夾",
      appProperties: { app: "weathermood", type: "backupFolder" },
    }),
  });
  return createResponse.json();
}

async function openDriveBackups() {
  const button = $("#importFromDrive");
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  try {
    await requestDriveAccessToken();
    $("#importDialog").close();
    if (!$("#driveBackupDialog").open) $("#driveBackupDialog").showModal();
    await loadDriveBackups();
  } catch (error) {
    showToast(error.message);
  } finally {
    button.disabled = false;
    button.removeAttribute("aria-busy");
  }
}

async function loadDriveBackups() {
  const status = $("#driveBackupStatus");
  const list = $("#driveBackupList");
  const refreshButton = $("#refreshDriveBackups");
  status.textContent = "正在讀取備份…";
  list.innerHTML = "";
  refreshButton.disabled = true;
  try {
    const parameters = new URLSearchParams({
      q: "trashed = false and mimeType = 'application/json' and appProperties has { key='app' and value='weathermood' }",
      spaces: "drive",
      orderBy: "createdTime desc",
      pageSize: "100",
      fields: "files(id,name,createdTime,modifiedTime,size)",
    });
    const response = await driveRequest(`${GOOGLE_DRIVE_API}/files?${parameters}`);
    const { files = [] } = await response.json();
    if (!files.length) {
      status.textContent = "目前沒有心晴日記的 Google Drive 備份。";
      return;
    }
    status.textContent = `找到 ${files.length} 份備份，選擇一份即可匯入。`;
    list.innerHTML = files.map((file) => {
      const createdAt = new Intl.DateTimeFormat("zh-TW", {
        year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
      }).format(new Date(file.createdTime));
      return `<button class="drive-backup-item" type="button" data-drive-file-id="${escapeHtml(file.id)}">
        <span class="drive-backup-name">${escapeHtml(file.name)}</span>
        <span class="drive-backup-date">${escapeHtml(createdAt)}</span>
        <span class="drive-backup-arrow" aria-hidden="true">›</span>
      </button>`;
    }).join("");
  } catch (error) {
    status.textContent = error.message;
  } finally {
    refreshButton.disabled = false;
  }
}

async function importDriveBackup(event) {
  const button = event.target.closest("[data-drive-file-id]");
  if (!button) return;
  const buttons = $$("#driveBackupList .drive-backup-item");
  buttons.forEach((item) => { item.disabled = true; });
  $("#driveBackupStatus").textContent = "正在匯入備份…";
  try {
    const fileId = encodeURIComponent(button.dataset.driveFileId);
    const response = await driveRequest(`${GOOGLE_DRIVE_API}/files/${fileId}?alt=media`);
    const text = (await response.text()).replace(/^\uFEFF/, "");
    const entries = parseJsonEntries(text).map(normalizeImportedEntry).filter(Boolean);
    if (!entries.length) throw new Error("備份中沒有可匯入的日記資料");
    const added = applyImportedEntries(entries);
    $("#driveBackupDialog").close();
    showImportResult(added);
  } catch (error) {
    $("#driveBackupStatus").textContent = `匯入失敗：${error.message}`;
  } finally {
    buttons.forEach((item) => { item.disabled = false; });
  }
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
    const added = applyImportedEntries(entries);
    showImportResult(added);
  } catch (error) {
    showToast(`匯入失敗：${error.message}`);
  }
}

function applyImportedEntries(entries) {
  const entryIds = new Set(state.entries.map((entry) => entry.id));
  const newEntries = entries.filter((entry) => !entryIds.has(entry.id));
  state.entries = [...newEntries, ...state.entries].sort((a, b) => b.localDate.localeCompare(a.localDate));
  persistEntries();
  renderEntries();
  loadTodayEntry();
  return newEntries.length;
}

function showImportResult(added) {
  showToast(added ? `已匯入 ${added} 則日記` : "沒有新增日記；備份中的紀錄都已存在。");
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
    location: find("地點", "location"), latitude: find("緯度", "latitude", "lat"), longitude: find("經度", "longitude", "lon", "lng"),
    temperature: find("溫度°c", "temperature"), feelsLike: find("體感°c", "feelslike"),
    humidity: find("濕度%", "humidity"), pressure: find("氣壓hpa", "pressure"), description: find("天氣", "description"),
  };
  return rows.slice(1).filter((row) => row.some((cell) => cell.trim())).map((row) => {
    const value = (key, fallback = -1) => {
      const index = indexes[key] >= 0 ? indexes[key] : fallback;
      return index >= 0 ? row[index] ?? "" : "";
    };
    return { localDate: value("localDate", 0), mood: value("mood", 1), note: value("note", 2), weather: {
      location: value("location", 3), latitude: value("latitude"), longitude: value("longitude"),
      temperature: value("temperature", 6), feelsLike: value("feelsLike", 7), humidity: value("humidity", 8),
      pressure: value("pressure", 9), description: value("description", 10),
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
    latitude: numberOrValue(entry.weather.latitude), longitude: numberOrValue(entry.weather.longitude),
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
