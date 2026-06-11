// Service worker: translates subtitles through a proxy (Cloudflare Worker →
// Google Cloud Translation). The Google API key lives in the proxy, not here.
//
// Translation cache is stored in chrome.storage.local and survives worker unloads.

const MEM_CACHE = new Map(); // `${target}\n${source}\n${text}` -> translation
const CACHE_LIMIT = 5000;
const STORAGE_KEY = "pvst_cache";
const MAX_RETRIES = 3;

// Default proxy (the project's shared server). Used when the user has not set a
// custom one in the options. A custom proxy overrides this address.
const DEFAULT_PROXY_URL =
  "https://pv-subtitle-translator.prtranslator.workers.dev";

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
    /* empty cache — not critical */
  }
  cacheLoaded = true;
}

function schedulePersist() {
  if (persistTimer) return;
  persistTimer = setTimeout(async () => {
    persistTimer = null;
    // Trim to the limit, keeping the most recently inserted entries.
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

async function getEndpoint() {
  const { proxyUrl } = await chrome.storage.sync.get({ proxyUrl: "" });
  const custom = (proxyUrl || "").trim().replace(/\/+$/, "");
  return custom || DEFAULT_PROXY_URL;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Translates an array of strings, returning translations in the same order.
// Strings already in the cache are not sent to the proxy.
async function translateBatch(texts, target, source) {
  // Google v2 rejects "auto" as a source language — for auto-detection the
  // parameter must be omitted. Normalize "auto"/empty to null.
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
    return true; // asynchronous response
  }
});

// Keyboard shortcut: toggle translation on/off (default Alt+Shift+S).
chrome.commands?.onCommand.addListener((command) => {
  if (command === "toggle-translation") {
    chrome.storage.sync.get({ enabled: true }, ({ enabled }) => {
      chrome.storage.sync.set({ enabled: !enabled });
    });
  }
});
