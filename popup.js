const DEFAULTS = {
  enabled: true,
  target: "ru",
  showOriginal: false,
  fontSize: 28,
};

const els = {
  enabled: document.getElementById("enabled"),
  target: document.getElementById("target"),
  showOriginal: document.getElementById("showOriginal"),
  fontSize: document.getElementById("fontSize"),
  fontSizeVal: document.getElementById("fontSizeVal"),
  openOptions: document.getElementById("openOptions"),
};

function load() {
  chrome.storage.sync.get(DEFAULTS, (s) => {
    els.enabled.checked = s.enabled;
    els.target.value = s.target;
    els.showOriginal.checked = s.showOriginal;
    els.fontSize.value = s.fontSize;
    els.fontSizeVal.textContent = s.fontSize;
  });
}

function save(patch) {
  chrome.storage.sync.set(patch);
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

els.openOptions.addEventListener("click", () => chrome.runtime.openOptionsPage());

load();
