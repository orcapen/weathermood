const OPENWEATHER_ENDPOINT = "https://api.openweathermap.org/data/2.5/weather";

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
};

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...headers },
  });
}

function errorResponse(code, message, status, headers = {}) {
  return jsonResponse(
    { error: { code, message } },
    status,
    { "Cache-Control": "no-store", ...headers },
  );
}

function parseCoordinate(value, minimum, maximum) {
  if (value === null || value.trim() === "") return null;
  const coordinate = Number(value);
  return Number.isFinite(coordinate) && coordinate >= minimum && coordinate <= maximum
    ? coordinate
    : null;
}

export async function onRequest(context) {
  if (context.request.method !== "GET") {
    return errorResponse(
      "method_not_allowed",
      "此端點只接受 GET 請求。",
      405,
      { Allow: "GET" },
    );
  }

  const requestUrl = new URL(context.request.url);
  const latitude = parseCoordinate(requestUrl.searchParams.get("lat"), -90, 90);
  const longitude = parseCoordinate(requestUrl.searchParams.get("lon"), -180, 180);

  if (latitude === null || longitude === null) {
    return errorResponse(
      "invalid_coordinates",
      "lat 與 lon 為必填，且必須是有效的經緯度。",
      400,
    );
  }

  const rawApiKey = context.env.WEATHER_API_KEY;
  if (typeof rawApiKey !== "string" || rawApiKey.trim() === "") {
    return errorResponse(
      "weather_service_not_configured",
      "天氣服務尚未完成設定。",
      500,
    );
  }
  const apiKey = rawApiKey.trim();

  const upstreamUrl = new URL(OPENWEATHER_ENDPOINT);
  upstreamUrl.search = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
    appid: apiKey,
    units: "metric",
    lang: "zh_tw",
  }).toString();

  let upstreamResponse;
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      headers: { Accept: "application/json" },
    });
  } catch {
    return errorResponse(
      "weather_provider_unreachable",
      "天氣服務暫時無法連線，請稍後再試。",
      502,
    );
  }

  if (!upstreamResponse.ok) {
    if (upstreamResponse.status === 401 || upstreamResponse.status === 403) {
      return errorResponse(
        "weather_service_not_configured",
        "天氣服務尚未完成設定。",
        500,
      );
    }
    const status = upstreamResponse.status === 429 ? 503 : 502;
    return errorResponse(
      upstreamResponse.status === 429 ? "weather_provider_busy" : "weather_provider_error",
      "天氣服務暫時無法回應，請稍後再試。",
      status,
    );
  }

  let data;
  try {
    data = await upstreamResponse.json();
  } catch {
    return errorResponse(
      "invalid_weather_response",
      "天氣服務回傳了無法辨識的資料。",
      502,
    );
  }

  const temperature = data?.main?.temp;
  const feelsLike = data?.main?.feels_like;
  const humidity = data?.main?.humidity;
  const pressure = data?.main?.pressure;

  if (
    ![temperature, feelsLike, humidity, pressure]
      .every((value) => typeof value === "number" && Number.isFinite(value))
    || humidity < 0
    || humidity > 100
    || pressure <= 0
  ) {
    return errorResponse(
      "invalid_weather_response",
      "天氣服務回傳的資料不完整。",
      502,
    );
  }

  const currentCondition = Array.isArray(data?.weather) ? data.weather[0] : null;
  const location = typeof data?.name === "string" && data.name.trim() ? data.name.trim() : "目前位置";
  const condition = typeof currentCondition?.main === "string" && currentCondition.main
    ? currentCondition.main
    : "Clouds";
  const description = typeof currentCondition?.description === "string"
    ? currentCondition.description
    : "";

  return jsonResponse(
    {
      location,
      temperature: Math.round(temperature),
      feelsLike: Math.round(feelsLike),
      humidity,
      pressure,
      condition,
      description,
    },
    200,
    { "Cache-Control": "private, max-age=60" },
  );
}
