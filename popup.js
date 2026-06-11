const DEFAULTS = {
  enabled: true,
  target: "ru",
  showOriginal: false,
  fontSize: 28,
  proxyUrl: "",
};

const els = {
  enabled: document.getElementById("enabled"),
  target: document.getElementById("target"),
  showOriginal: document.getElementById("showOriginal"),
  fontSize: document.getElementById("fontSize"),
  fontSizeVal: document.getElementById("fontSizeVal"),
  proxyUrl: document.getElementById("proxyUrl"),
  proxyStatus: document.getElementById("proxyStatus"),
};

function load() {
  chrome.storage.sync.get(DEFAULTS, (s) => {
    els.enabled.checked = s.enabled;
    els.target.value = s.target;
    els.showOriginal.checked = s.showOriginal;
    els.fontSize.value = s.fontSize;
    els.fontSizeVal.textContent = s.fontSize;
    els.proxyUrl.value = s.proxyUrl;
    setStatus(s.proxyUrl ? "" : "Не задан — переводы не работают", s.proxyUrl ? "" : "err");
  });
}

function save(patch) {
  chrome.storage.sync.set(patch);
}

function setStatus(text, cls) {
  els.proxyStatus.textContent = text;
  els.proxyStatus.className = "status" + (cls ? " " + cls : "");
}

els.enabled.addEventListener("change", () =>
  save({ enabled: els.enabled.checked })
);
els.target.addEventListener("change", () => save({ target: els.target.value }));
els.showOriginal.addEventListener("change", () =>
  save({ showOriginal: els.showOriginal.checked })
);
els.fontSize.addEventListener("input", () => {
  els.fontSizeVal.textContent = els.fontSize.value;
  save({ fontSize: Number(els.fontSize.value) });
});

els.proxyUrl.addEventListener("change", () => {
  const url = els.proxyUrl.value.trim().replace(/\/+$/, "");
  if (url && !/^https:\/\/.+/.test(url)) {
    setStatus("Адрес должен начинаться с https://", "err");
    return;
  }
  save({ proxyUrl: url });
  setStatus(url ? "Сохранено" : "Не задан — переводы не работают", url ? "ok" : "err");
});

load();
