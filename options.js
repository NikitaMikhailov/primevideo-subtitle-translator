const proxyUrl = document.getElementById("proxyUrl");
const proxyStatus = document.getElementById("proxyStatus");

function setStatus(text, cls) {
  proxyStatus.textContent = text;
  proxyStatus.className = "status" + (cls ? " " + cls : "");
}

chrome.storage.sync.get({ proxyUrl: "" }, (s) => {
  proxyUrl.value = s.proxyUrl;
  setStatus(
    s.proxyUrl ? "Server configured" : "No server set — translation won't work",
    s.proxyUrl ? "ok" : "err"
  );
});

proxyUrl.addEventListener("change", () => {
  const url = proxyUrl.value.trim().replace(/\/+$/, "");
  if (url && !/^https:\/\/.+/.test(url)) {
    setStatus("URL must start with https://", "err");
    return;
  }
  chrome.storage.sync.set({ proxyUrl: url });
  setStatus(
    url ? "Saved" : "No server set — translation won't work",
    url ? "ok" : "err"
  );
});
