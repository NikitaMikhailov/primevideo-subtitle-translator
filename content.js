// Reads Prime Video's built-in subtitles and shows a translation over the player.
// Translation runs in background.js through a proxy (Google Cloud Translation).

(() => {
  "use strict";

  const DEFAULTS = {
    enabled: true,
    target: "ru",
    showOriginal: false,
    fontSize: 28,
    proxyUrl: "",
  };

  // Stable Amazon web player class; fallback by substring just in case.
  const CAPTION_SELECTOR =
    '.atvwebplayersdk-captions-text, [class*="captions-text"]';
  const CAPTION_OVERLAY_SELECTOR =
    '.atvwebplayersdk-captions-overlay, [class*="captions-overlay"]';

  let settings = { ...DEFAULTS };
  let overlayEl = null;
  let styleHideEl = null;
  let toastEl = null;
  let toastTimer = null;
  let lastSourceText = "";
  let requestSeq = 0;

  let captionObserver = null;
  let observedOverlay = null;
  let rootObserver = null;
  let debounceTimer = null;

  // Health-check: warn in the console if the player is playing but no subtitles
  // are found for a while (Amazon may have changed the markup — update selector).
  let lastCaptionSeenAt = Date.now();
  let healthWarned = false;

  // --- Reading subtitles -----------------------------------------------------

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

  // --- Overlay ---------------------------------------------------------------

  function ensureOverlay() {
    if (!overlayEl || !overlayEl.isConnected) {
      overlayEl = document.createElement("div");
      overlayEl.id = "pvst-overlay";
      overlayEl.setAttribute("aria-hidden", "true");
    }
    relocateOverlay();
    return overlayEl;
  }

  // In fullscreen the browser only renders the fullscreen element and its
  // descendants (top layer). An overlay on documentElement would be occluded
  // and disappear — so keep it inside document.fullscreenElement when present.
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

  // IMPORTANT: hide native subtitles with opacity:0, NOT visibility:hidden —
  // innerText returns "" for visibility:hidden/display:none elements, which
  // would make the subtitle unreadable. opacity:0 keeps the element rendered.
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

  // Brief on-screen confirmation, e.g. when toggled via the keyboard shortcut.
  function showToast(text) {
    if (!toastEl || !toastEl.isConnected) {
      toastEl = document.createElement("div");
      toastEl.id = "pvst-toast";
    }
    const host = document.fullscreenElement || document.documentElement;
    if (toastEl.parentElement !== host) host.appendChild(toastEl);
    toastEl.textContent = text;
    toastEl.style.opacity = "1";
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      if (toastEl) toastEl.style.opacity = "0";
    }, 1200);
  }

  // --- Translating the current cue -------------------------------------------

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
        source: null, // null = auto-detect (Google v2 does not accept "auto")
      });
      if (seq !== requestSeq) return; // a newer cue arrived
      if (resp && resp.ok) {
        renderOverlay(resp.translations[0], text);
      } else if (resp && resp.code === "no_proxy_configured") {
        renderOverlay("⚙ Set a translation server in the extension options", "");
      } else {
        renderOverlay(text, ""); // on error, show the original
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

  // --- Observing the DOM -----------------------------------------------------

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
    scheduleHandle(); // process whatever is already on screen
    return true;
  }

  // The captions container appears/recreates when the player starts — watch the
  // whole document to (re)attach to it.
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
          "[PV Subtitle Translator] No subtitle container found for 25s while " +
            "playing. Turn on subtitles (CC) in the player, or Amazon changed the " +
            "markup — update CAPTION_SELECTOR in content.js."
        );
      }
    }, 5000);
  }

  // --- State -----------------------------------------------------------------

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
    if (!changed) return;
    // Visible feedback for the keyboard-shortcut toggle.
    if ("enabled" in changes) {
      showToast(
        settings.enabled ? "Subtitle translation: ON" : "Subtitle translation: OFF"
      );
    }
    applyOverlayStyle();
    applyEnabledState();
    lastSourceText = "";
    scheduleHandle();
  });

  // --- Startup ---------------------------------------------------------------

  // When entering/leaving fullscreen, move the overlay into the right host.
  document.addEventListener("fullscreenchange", () => {
    if (settings.enabled) relocateOverlay();
  });

  loadSettings(() => {
    applyEnabledState();
    startHealthCheck();
  });
})();
