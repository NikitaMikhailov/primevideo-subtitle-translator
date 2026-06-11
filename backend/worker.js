// Cloudflare Worker — прокси к Google Cloud Translation API v2.
// Держит API-ключ в секрете (Worker Secret GOOGLE_API_KEY), чтобы он не попал
// в код расширения. Принимает батч строк, возвращает переводы.
//
// Деплой: см. backend/README.md
//
// Запрос:  POST /  { "texts": ["...", "..."], "target": "ru", "source": "en"|null }
// Ответ:   200    { "translations": ["...", "..."] }

const ALLOWED_ORIGIN_PREFIX = "chrome-extension://";
const MAX_TEXTS = 50;
const MAX_CHARS = 5000; // суммарно за запрос, защита от злоупотреблений

// Грубый per-IP rate limit в памяти изолята (best-effort, не строгий).
const hits = new Map(); // ip -> { count, resetAt }
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 600;

function rateLimited(ip) {
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now > rec.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  rec.count += 1;
  return rec.count > MAX_PER_WINDOW;
}

function corsHeaders(origin) {
  // Разрешаем только наше расширение (chrome-extension://<id>).
  const allow =
    origin && origin.startsWith(ALLOWED_ORIGIN_PREFIX) ? origin : "null";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (request.method !== "POST") {
      return json({ error: "method_not_allowed" }, 405, origin);
    }
    if (!origin.startsWith(ALLOWED_ORIGIN_PREFIX)) {
      return json({ error: "forbidden_origin" }, 403, origin);
    }

    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    if (rateLimited(ip)) {
      return json({ error: "rate_limited" }, 429, origin);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ error: "bad_json" }, 400, origin);
    }

    const texts = Array.isArray(payload.texts) ? payload.texts : null;
    const target = String(payload.target || "").trim();
    // Google v2: для автоопределения source нужно опускать; "auto" недопустим.
    let source = payload.source ? String(payload.source).trim() : null;
    if (source === "auto") source = null;

    if (!texts || !texts.length || !target) {
      return json({ error: "missing_params" }, 400, origin);
    }
    if (texts.length > MAX_TEXTS) {
      return json({ error: "too_many_texts" }, 400, origin);
    }
    const totalChars = texts.reduce((n, t) => n + String(t).length, 0);
    if (totalChars > MAX_CHARS) {
      return json({ error: "too_many_chars" }, 400, origin);
    }

    const params = new URLSearchParams();
    texts.forEach((t) => params.append("q", String(t)));
    params.set("target", target);
    params.set("format", "text");
    if (source) params.set("source", source);

    const gUrl =
      "https://translation.googleapis.com/language/translate/v2?key=" +
      encodeURIComponent(env.GOOGLE_API_KEY);

    let gRes;
    try {
      gRes = await fetch(gUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });
    } catch {
      return json({ error: "upstream_unreachable" }, 502, origin);
    }

    if (!gRes.ok) {
      const detail = await gRes.text().catch(() => "");
      return json(
        { error: "upstream_error", status: gRes.status, detail: detail.slice(0, 300) },
        502,
        origin
      );
    }

    const data = await gRes.json();
    const translations = (data.data?.translations || []).map(
      (t) => t.translatedText
    );
    return json({ translations }, 200, origin);
  },
};
