// Service worker: переводит субтитры через собственный прокси (Cloudflare Worker
// → Google Cloud Translation). Ключ Google живёт в прокси, не в расширении.
//
// Кэш переводов хранится в chrome.storage.local и переживает выгрузку воркера.

const MEM_CACHE = new Map(); // `${target}\n${source}\n${text}` -> перевод
const CACHE_LIMIT = 5000;
const STORAGE_KEY = "pvst_cache";
const MAX_RETRIES = 3;

let cacheLoaded = false;
let persistTimer = null;

function cacheKey(text, target, source) {
  return `${target}\n${source || "auto"}\n${text}`;
}

async function loadCache() {
  if (cacheLoaded) return;
  try {
    const obj = await chrome.storage.local.get(STORAGE_KEY);
    const stored = obj[STORAGE_KEY] || {};
    for (const [k, v] of Object.entries(stored)) MEM_CACHE.set(k, v);
  } catch {
    /* пустой кэш — не критично */
  }
  cacheLoaded = true;
}

function schedulePersist() {
  if (persistTimer) return;
  persistTimer = setTimeout(async () => {
    persistTimer = null;
    // обрезаем до лимита (оставляем последние вставленные)
    let entries = [...MEM_CACHE.entries()];
    if (entries.length > CACHE_LIMIT) {
      entries = entries.slice(entries.length - CACHE_LIMIT);
      MEM_CACHE.clear();
      for (const [k, v] of entries) MEM_CACHE.set(k, v);
    }
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: Object.fromEntries(entries) });
    } catch {}
  }, 3000);
}

// Прокси по умолчанию (общий сервер проекта). Используется, если пользователь
// не задал свой в настройках. Свой прокси переопределяет этот адрес.
const DEFAULT_PROXY_URL =
  "https://pv-subtitle-translator.prtranslator.workers.dev";

async function getEndpoint() {
  const { proxyUrl } = await chrome.storage.sync.get({ proxyUrl: "" });
  const custom = (proxyUrl || "").trim().replace(/\/+$/, "");
  return custom || DEFAULT_PROXY_URL;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Переводит массив строк. Возвращает массив переводов в том же порядке.
// Уже закэшированные строки не отправляются на прокси.
async function translateBatch(texts, target, source) {
  // Google v2 не принимает "auto" как источник — для автоопределения параметр
  // нужно опускать. Нормализуем "auto"/пусто к null.
  if (!source || source === "auto") source = null;
  await loadCache();

  const result = new Array(texts.length);
  const missingIdx = [];
  const missingTexts = [];

  texts.forEach((t, i) => {
    const cached = MEM_CACHE.get(cacheKey(t, target, source));
    if (cached !== undefined) result[i] = cached;
    else {
      missingIdx.push(i);
      missingTexts.push(t);
    }
  });

  if (!missingTexts.length) return result;

  const endpoint = await getEndpoint();
  if (!endpoint) {
    const err = new Error("no_proxy_configured");
    err.code = "no_proxy_configured";
    throw err;
  }

  let lastErr;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts: missingTexts, target, source: source || null }),
      });
      if (res.status === 429) {
        await sleep(500 * 2 ** attempt);
        continue;
      }
      if (!res.ok) throw new Error(`proxy HTTP ${res.status}`);

      const data = await res.json();
      const translations = data.translations || [];
      missingIdx.forEach((origIdx, k) => {
        const tr = translations[k] != null ? translations[k] : missingTexts[k];
        result[origIdx] = tr;
        MEM_CACHE.set(cacheKey(missingTexts[k], target, source), tr);
      });
      schedulePersist();
      return result;
    } catch (e) {
      lastErr = e;
      await sleep(300 * 2 ** attempt);
    }
  }
  throw lastErr || new Error("translate_failed");
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "translate") {
    const texts = msg.texts || (msg.text != null ? [msg.text] : []);
    translateBatch(texts, msg.target, msg.source || null)
      .then((translations) =>
        sendResponse({ ok: true, translations, translated: translations[0] })
      )
      .catch((err) =>
        sendResponse({ ok: false, error: String(err), code: err.code || null })
      );
    return true; // ответ асинхронный
  }
});
