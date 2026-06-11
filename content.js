// Читает встроенные субтитры Prime Video и показывает перевод поверх плеера.
// Перевод выполняется в background.js через прокси (Google Cloud Translation).

(() => {
  "use strict";

  const DEFAULTS = {
    enabled: true,
    target: "ru",
    showOriginal: false,
    fontSize: 28,
    proxyUrl: "",
  };

  // Стабильный класс веб-плеера Amazon. Запасной — по подстроке.
  const CAPTION_SELECTOR =
    '.atvwebplayersdk-captions-text, [class*="captions-text"]';
  const CAPTION_OVERLAY_SELECTOR =
    '.atvwebplayersdk-captions-overlay, [class*="captions-overlay"]';

  let settings = { ...DEFAULTS };
  let overlayEl = null;
  let styleHideEl = null;
  let lastSourceText = "";
  let requestSeq = 0;

  let captionObserver = null;
  let observedOverlay = null;
  let rootObserver = null;
  let debounceTimer = null;

  // health-check: предупреждаем в консоль, если при играющем видео долго нет
  // субтитров (возможно, Amazon сменил разметку — нужно обновить селектор).
  let lastCaptionSeenAt = Date.now();
  let healthWarned = false;

  // --- Чтение субтитров ------------------------------------------------------

  function readCaptionText() {
    const nodes = document.querySelectorAll(CAPTION_SELECTOR);
    if (!nodes.length) return "";
    const lines = [];
    nodes.forEach((n) => {
      const t = (n.innerText || n.textContent || "").trim();
      if (t) lines.push(t);
    });
    return lines.join("\n").trim();
  }

  // --- Оверлей ---------------------------------------------------------------

  function ensureOverlay() {
    if (!overlayEl || !overlayEl.isConnected) {
      overlayEl = document.createElement("div");
      overlayEl.id = "pvst-overlay";
      overlayEl.setAttribute("aria-hidden", "true");
    }
    relocateOverlay();
    return overlayEl;
  }

  // В полноэкранном режиме рендерится только fullscreen-элемент и его потомки.
  // Оверлей в documentElement в честном fullscreen перекрывается top-layer'ом и
  // пропадает — поэтому держим его внутри document.fullscreenElement, когда он есть.
  function relocateOverlay() {
    if (!overlayEl) return;
    const host = document.fullscreenElement || document.documentElement;
    if (overlayEl.parentElement !== host) host.appendChild(overlayEl);
  }

  function applyOverlayStyle() {
    ensureOverlay().style.fontSize = `${settings.fontSize}px`;
  }

  function renderOverlay(translated, original) {
    const el = ensureOverlay();
    if (!translated) {
      el.style.display = "none";
      el.replaceChildren();
      return;
    }
    el.style.display = "block";
    el.replaceChildren();

    const tr = document.createElement("div");
    tr.className = "pvst-translated";
    tr.textContent = translated;
    el.appendChild(tr);

    if (settings.showOriginal && original) {
      const or = document.createElement("div");
      or.className = "pvst-original";
      or.textContent = original;
      el.appendChild(or);
    }
  }

  function hideOverlay() {
    if (overlayEl) {
      overlayEl.style.display = "none";
      overlayEl.replaceChildren();
    }
  }

  // ВАЖНО: скрываем родные субтитры через opacity:0, а НЕ visibility:hidden —
  // innerText возвращает пустую строку для visibility:hidden/display:none, и
  // тогда субтитр не прочитать. opacity:0 оставляет элемент отрендеренным.
  function setNativeCaptionsHidden(hidden) {
    if (hidden) {
      if (!styleHideEl) {
        styleHideEl = document.createElement("style");
        styleHideEl.id = "pvst-hide-native";
        styleHideEl.textContent = `${CAPTION_SELECTOR} { opacity: 0 !important; }`;
        document.documentElement.appendChild(styleHideEl);
      }
    } else if (styleHideEl) {
      styleHideEl.remove();
      styleHideEl = null;
    }
  }

  // --- Перевод текущей реплики ----------------------------------------------

  async function handleCaptionChange() {
    if (!settings.enabled) return;

    const text = readCaptionText();
    if (text) {
      lastCaptionSeenAt = Date.now();
      healthWarned = false;
    }
    if (text === lastSourceText) return;
    lastSourceText = text;

    if (!text) {
      hideOverlay();
      return;
    }

    const seq = ++requestSeq;
    try {
      const resp = await chrome.runtime.sendMessage({
        type: "translate",
        texts: [text],
        target: settings.target,
        source: null, // null = автоопределение (Google v2 не принимает "auto")
      });
      if (seq !== requestSeq) return; // пришёл более новый субтитр
      if (resp && resp.ok) {
        renderOverlay(resp.translations[0], text);
      } else if (resp && resp.code === "no_proxy_configured") {
        renderOverlay("⚙️ Укажите адрес прокси в настройках расширения", "");
      } else {
        renderOverlay(text, ""); // при ошибке показываем оригинал
      }
    } catch (e) {
      if (seq !== requestSeq) return;
      renderOverlay(text, "");
    }
  }

  function scheduleHandle() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(handleCaptionChange, 120);
  }

  // --- Наблюдение за DOM -----------------------------------------------------

  function attachCaptionObserver() {
    const overlay = document.querySelector(CAPTION_OVERLAY_SELECTOR);
    if (!overlay) return false;
    if (overlay === observedOverlay && captionObserver) return true;
    if (captionObserver) captionObserver.disconnect();
    observedOverlay = overlay;
    captionObserver = new MutationObserver(scheduleHandle);
    captionObserver.observe(overlay, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    scheduleHandle(); // обработать то, что уже на экране
    return true;
  }

  // Контейнер субтитров появляется/пересоздаётся при запуске плеера —
  // следим за всем документом, чтобы (пере)подключаться к нему.
  function startRootObserver() {
    if (rootObserver) return;
    rootObserver = new MutationObserver(() => {
      const overlay = document.querySelector(CAPTION_OVERLAY_SELECTOR);
      if (overlay && overlay !== observedOverlay) attachCaptionObserver();
      else if (observedOverlay && !document.documentElement.contains(observedOverlay)) {
        observedOverlay = null;
        attachCaptionObserver();
      }
    });
    rootObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  function startHealthCheck() {
    setInterval(() => {
      if (!settings.enabled) return;
      const video = document.querySelector("video");
      const playing = video && !video.paused && !video.ended && video.readyState > 2;
      if (
        playing &&
        !healthWarned &&
        Date.now() - lastCaptionSeenAt > 25000 &&
        !document.querySelector(CAPTION_OVERLAY_SELECTOR)
      ) {
        healthWarned = true;
        console.warn(
          "[PV Subtitle Translator] Контейнер субтитров не найден 25с при играющем видео. " +
            "Возможно, включи субтитры (CC) в плеере, либо Amazon сменил разметку — " +
            "тогда обнови CAPTION_SELECTOR в content.js."
        );
      }
    }, 5000);
  }

  // --- Состояние -------------------------------------------------------------

  function applyEnabledState() {
    if (settings.enabled) {
      setNativeCaptionsHidden(true);
      applyOverlayStyle();
      attachCaptionObserver();
      startRootObserver();
    } else {
      setNativeCaptionsHidden(false);
      hideOverlay();
      lastSourceText = "";
    }
  }

  function loadSettings(cb) {
    chrome.storage.sync.get(DEFAULTS, (stored) => {
      settings = { ...DEFAULTS, ...stored };
      if (cb) cb();
    });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    let changed = false;
    for (const k of Object.keys(changes)) {
      if (k in settings) {
        settings[k] = changes[k].newValue;
        changed = true;
      }
    }
    if (changed) {
      applyOverlayStyle();
      applyEnabledState();
      lastSourceText = "";
      scheduleHandle();
    }
  });

  // --- Запуск ----------------------------------------------------------------

  // При входе/выходе из полноэкранного режима переносим оверлей в нужный хост.
  document.addEventListener("fullscreenchange", () => {
    if (settings.enabled) relocateOverlay();
  });

  loadSettings(() => {
    applyEnabledState();
    startHealthCheck();
  });
})();
