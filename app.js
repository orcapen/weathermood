const STORAGE = { key: "weathermood.apiKey", records: "weathermood.records", location: "weathermood.location" };
const moods = { 1:["😞","很低落"], 2:["🙁","不太好"], 3:["😐","普通"], 4:["🙂","不錯"], 5:["😄","很好"] };
let currentWeather = null;
let deferredInstallPrompt = null;

const $ = (selector) => document.querySelector(selector);
const els = {
  settings: $("#settingsDialog"), apiKey: $("#apiKey"), weatherStatus: $("#weatherStatus"),
  weatherEmpty: $("#weatherEmpty"), weatherContent: $("#weatherContent"), saveStatus: $("#saveStatus"),
  recordList: $("#recordList"), recordsEmpty: $("#recordsEmpty"), clearRecords: $("#clearRecords"), exportCsv: $("#exportCsv"), insight: $("#insight")
};

function init() {
  const now = new Date();
  $("#todayWeekday").textContent = new Intl.DateTimeFormat("zh-TW", { weekday:"long" }).format(now);
  $("#todayDate").textContent = new Intl.DateTimeFormat("zh-TW", { month:"short", day:"numeric" }).format(now);
  bindEvents(); renderRecords(); updateOnlineState();
  const savedLocation = readJson(STORAGE.location, null);
  if (localStorage.getItem(STORAGE.key) && savedLocation) fetchWeather(savedLocation);
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js");
}

function bindEvents() {
  $("#settingsButton").addEventListener("click", openSettings);
  $("#settingsForm").addEventListener("submit", saveSettings);
  $("#locateButton").addEventListener("click", locate);
  $("#refreshWeather").addEventListener("click", () => { const loc=readJson(STORAGE.location,null); loc ? fetchWeather(loc) : locate(); });
  $("#cityForm").addEventListener("submit", (event) => { event.preventDefault(); const city=$("#cityInput").value.trim(); if(city) fetchWeather({ city }); });
  $("#moodForm").addEventListener("submit", saveRecord);
  els.clearRecords.addEventListener("click", clearAllRecords);
  els.exportCsv.addEventListener("click", exportRecordsCsv);
  window.addEventListener("online", updateOnlineState); window.addEventListener("offline", updateOnlineState);
  window.addEventListener("beforeinstallprompt", (event) => { event.preventDefault(); deferredInstallPrompt=event; $("#installButton").hidden=false; });
  $("#installButton").addEventListener("click", async () => { if(!deferredInstallPrompt)return; deferredInstallPrompt.prompt(); await deferredInstallPrompt.userChoice; deferredInstallPrompt=null; $("#installButton").hidden=true; });
}

function openSettings() { els.apiKey.value=localStorage.getItem(STORAGE.key)||""; els.settings.showModal(); }
function saveSettings(event) { event.preventDefault(); const key=els.apiKey.value.trim(); if(!key)return; localStorage.setItem(STORAGE.key,key); els.settings.close(); setStatus("API key 已儲存在這個瀏覽器。", false); const loc=readJson(STORAGE.location,null); if(loc)fetchWeather(loc); }

function locate() {
  if (!ensureKey() || !navigator.geolocation) return;
  setLoading(true,"正在取得你的位置…");
  navigator.geolocation.getCurrentPosition(
    ({coords}) => fetchWeather({ lat:coords.latitude, lon:coords.longitude }),
    () => { setLoading(false,"無法取得位置，請改用城市搜尋。"); },
    { enableHighAccuracy:false, timeout:10000, maximumAge:600000 }
  );
}

function ensureKey() { if(localStorage.getItem(STORAGE.key))return true; setStatus("請先設定 OpenWeatherMap API key。",true); openSettings(); return false; }

async function fetchWeather(location) {
  if(!ensureKey())return;
  if(!navigator.onLine){ setStatus("目前離線，仍可瀏覽及新增既有天氣的心情紀錄。",true); return; }
  setLoading(true,"正在向天空取得消息…");
  const params = new URLSearchParams({ appid:localStorage.getItem(STORAGE.key), units:"metric", lang:"zh_tw" });
  if(location.city) params.set("q",location.city); else { params.set("lat",location.lat); params.set("lon",location.lon); }
  const controller=new AbortController(); const timeout=setTimeout(()=>controller.abort(),12000);
  try {
    const response=await fetch(`https://api.openweathermap.org/data/2.5/weather?${params}`,{signal:controller.signal});
    const data=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(response.status===401 ? "API key 無效或尚未啟用。" : response.status===404 ? "找不到這座城市。" : data.message || `天氣服務錯誤 (${response.status})`);
    currentWeather={ city:data.name, country:data.sys?.country||"", temperature:Math.round(data.main.temp), pressure:data.main.pressure, humidity:data.main.humidity, cloudiness:data.clouds.all, description:data.weather[0].description, icon:data.weather[0].icon, fetchedAt:new Date().toISOString() };
    localStorage.setItem(STORAGE.location,JSON.stringify(location)); renderWeather(); setStatus("剛剛更新",false);
  } catch(error) { setStatus(error.name==="AbortError" ? "連線逾時，請稍後再試。" : error.message||"無法取得天氣資料。",true); }
  finally { clearTimeout(timeout); setLoading(false); }
}

function renderWeather() {
  if(!currentWeather)return;
  els.weatherEmpty.hidden=true; els.weatherContent.hidden=false;
  $("#locationName").textContent=[currentWeather.city,currentWeather.country].filter(Boolean).join(", ");
  $("#temperature").textContent=`${currentWeather.temperature}°`;
  $("#weatherDescription").textContent=currentWeather.description;
  $("#humidity").textContent=`${currentWeather.humidity}%`; $("#pressure").textContent=`${currentWeather.pressure} hPa`; $("#cloudiness").textContent=`${currentWeather.cloudiness}%`;
  const icon=$("#weatherIcon"); icon.src=`https://openweathermap.org/img/wn/${currentWeather.icon}@2x.png`; icon.alt=currentWeather.description;
}

function saveRecord(event) {
  event.preventDefault(); const form=new FormData(event.currentTarget); const mood=Number(form.get("mood"));
  if(!mood)return;
  const records=readJson(STORAGE.records,[]);
  records.unshift({ id:crypto.randomUUID?.()||String(Date.now()), createdAt:new Date().toISOString(), mood, note:$("#note").value.trim(), weather:currentWeather ? {...currentWeather}:null });
  localStorage.setItem(STORAGE.records,JSON.stringify(records)); event.currentTarget.reset(); els.saveStatus.textContent="已把今天收進日記裡。"; setTimeout(()=>els.saveStatus.textContent="",3000); renderRecords();
}

function renderRecords() {
  const records=readJson(STORAGE.records,[]); els.recordList.replaceChildren(); els.recordsEmpty.hidden=records.length>0; els.clearRecords.hidden=records.length===0; els.exportCsv.hidden=records.length===0;
  records.forEach(record => {
    const node=$("#recordTemplate").content.cloneNode(true); const root=node.querySelector(".record-item"); const date=new Date(record.createdAt);
    node.querySelector(".record-date strong").textContent=new Intl.DateTimeFormat("zh-TW",{month:"short",day:"numeric"}).format(date);
    node.querySelector(".record-date span").textContent=new Intl.DateTimeFormat("zh-TW",{weekday:"short",hour:"2-digit",minute:"2-digit"}).format(date);
    const weather=node.querySelector(".record-weather");
    if(record.weather){ node.querySelector(".mini-weather").textContent=weatherEmoji(record.weather.icon); weather.querySelector("strong").textContent=`${record.weather.temperature}° · ${record.weather.city}`; weather.querySelector("div span").textContent=`濕度 ${record.weather.humidity}% · 雲量 ${record.weather.cloudiness}%`; }
    else { node.querySelector(".mini-weather").textContent="—"; weather.querySelector("strong").textContent="未記錄天氣"; weather.querySelector("div span").textContent=""; }
    node.querySelector(".record-mood>span").textContent=moods[record.mood][0]; node.querySelector(".record-mood strong").textContent=`${record.mood} / 5`; node.querySelector(".record-mood small").textContent=moods[record.mood][1];
    const note=node.querySelector(".record-note"); note.textContent=record.note||"沒有留下文字"; note.title=record.note||"";
    node.querySelector(".delete-record").addEventListener("click",()=>deleteRecord(record.id)); root.dataset.id=record.id; els.recordList.append(node);
  });
  renderInsight(records);
}

function renderInsight(records) { if(records.length<2){els.insight.hidden=true;return;} const avg=records.reduce((sum,r)=>sum+r.mood,0)/records.length; els.insight.hidden=false; els.insight.textContent=`這 ${records.length} 筆紀錄的平均心情是 ${avg.toFixed(1)} / 5。繼續記錄，會更容易看見自己的節奏。`; }
function deleteRecord(id) { const records=readJson(STORAGE.records,[]).filter(r=>r.id!==id); localStorage.setItem(STORAGE.records,JSON.stringify(records)); renderRecords(); }
function clearAllRecords() { if(confirm("確定要清除全部心情紀錄嗎？這個動作無法復原。")){ localStorage.removeItem(STORAGE.records); renderRecords(); } }
function exportRecordsCsv() {
  const records=readJson(STORAGE.records,[]);
  if(!records.length)return;
  const headers=["日期時間","心情分數","心情描述","備註","地點","國家","氣溫 (°C)","氣壓 (hPa)","濕度 (%)","天氣","雲量 (%)","天氣取得時間"];
  const rows=records.map(record=>{
    const weather=record.weather||{};
    return [record.createdAt,record.mood,moods[record.mood]?.[1]||"",record.note||"",weather.city||"",weather.country||"",weather.temperature??"",weather.pressure??"",weather.humidity??"",weather.description||"",weather.cloudiness??"",weather.fetchedAt||""];
  });
  const escape=value=>`"${String(value).replaceAll('"','""')}"`;
  const csv="\uFEFF"+[headers,...rows].map(row=>row.map(escape).join(",")).join("\r\n");
  const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
  const link=document.createElement("a");
  link.href=url; link.download=`weathermood-${new Date().toISOString().slice(0,10)}.csv`; document.body.append(link); link.click(); link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function readJson(key,fallback){ try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;} }
function setLoading(loading,message="") { [$("#locateButton"),$("#refreshWeather"),$("#cityForm button")].forEach(b=>b.disabled=loading); if(message)setStatus(message,false); }
function setStatus(message,isError) { els.weatherStatus.textContent=message; els.weatherStatus.style.color=isError?"#ffd1c7":""; }
function updateOnlineState() { $("#offlineBadge").hidden=navigator.onLine; }
function weatherEmoji(icon="") { const code=icon.slice(0,2); return ({"01":"☀️","02":"🌤️","03":"☁️","04":"☁️","09":"🌧️","10":"🌦️","11":"⛈️","13":"❄️","50":"🌫️"})[code]||"🌤️"; }
document.addEventListener("DOMContentLoaded",init);
