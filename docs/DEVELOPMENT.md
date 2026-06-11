# Development

## Architecture

```
content.js ──(subtitle text)──▶ background.js ──HTTPS──▶ Cloudflare Worker ──▶ Google Cloud Translation
   ▲ MutationObserver               │ cache + retries        │ holds the API key
   └──(translation overlay)─────────┘                        └ CORS: extension only
```

- **content.js** — uses a `MutationObserver` to catch built-in subtitle changes
  (`.atvwebplayersdk-captions-text`), hides them (`opacity:0`, so they stay
  readable) and renders its own translation overlay. In fullscreen the overlay is
  moved into `document.fullscreenElement`.
- **background.js** (service worker) — sends text to the proxy, retries with
  backoff, and keeps a persistent translation cache in `chrome.storage.local`.
  The proxy URL comes from settings (`proxyUrl`); there is no built-in default —
  if unset, translation does not run and the overlay prompts to configure a
  server.
- **backend/worker.js** — proxy to Google Cloud Translation v2 (see
  [`../backend/README.md`](../backend/README.md)).

## File map

| File | Purpose |
|------|---------|
| `manifest.json` | MV3 manifest |
| `content.js` | Subtitle reading, overlay, observers |
| `background.js` | Proxy calls, cache, retries |
| `overlay.css` | Translation overlay styling |
| `popup.html/.css/.js` | Popup settings |
| `options.html/.js` | Options page (server URL + setup guide) |
| `icons/` | 16/48/128 icons |
| `backend/worker.js` | Cloudflare Worker (proxy) |
| `backend/wrangler.toml` | Worker deploy config |

## Local development

1. `chrome://extensions/` → Developer mode → **Load unpacked** → repo root.
2. After editing `content.js`/`background.js`/popup/options, click **↻ reload**
   on the extension card (reloading the tab does NOT reload extension code), then
   Cmd+R on the video tab.
3. If reload doesn't pick up changes — **Remove** + **Load unpacked** again.

### Two consoles
- **content script**: F12 on the primevideo tab → Console.
- **background**: `chrome://extensions/` → the extension's "service worker" link.
  You can also test the proxy here (the extension context passes CORS):
  ```js
  fetch('https://<your-worker>.workers.dev', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({texts:['Hello world'], target:'ru'})
  }).then(r=>r.text().then(t=>console.log(r.status, t)));
  ```

## Diagnostic snippet (page console)

```js
JSON.stringify({
  contentScriptActive: !!document.getElementById('pvst-hide-native'),
  overlayText: document.getElementById('pvst-overlay')?.innerText || null,
  nativeText: [...document.querySelectorAll('.atvwebplayersdk-captions-text')].map(n=>n.innerText),
  nativeOpacity: getComputedStyle(document.querySelector('.atvwebplayersdk-captions-text')||document.body).opacity
}, null, 2)
```

## Testing (key scenarios)

| Scenario | Expected |
|----------|----------|
| Change language in the popup live | Next cue is in the new language |
| Fullscreen | Translation visible (overlay inside the fullscreen element) |
| Next episode | Translation keeps working without a reload |
| CC turned off | Overlay empty; ~25s health-check warning in the console |
| Proxy down / 429 | Original shown; retries with backoff, no request storm |
| Seek to a repeat | Instant from cache, no new requests |

## Releasing

Releases are automated. To cut a new version:

1. Bump `version` in `manifest.json`.
2. Update `CHANGELOG.md`, commit, and push to `main`.
3. Tag and push: `git tag vX.Y.Z && git push origin vX.Y.Z`.

The `Release` workflow (`.github/workflows/release.yml`) then checks that the tag
matches `manifest.json`, builds `dist/extension.zip`, and publishes a GitHub
Release for the tag with the zip attached. (The tag version must equal the
manifest version, or the workflow fails.)

## Resilience to Amazon changes

Classes like `f7j034j` are obfuscated and change between releases. The code
relies on the stable `atvwebplayersdk-captions-text`. If the markup changes, a
health-check warning appears in the console — update `CAPTION_SELECTOR` in
`content.js`.
