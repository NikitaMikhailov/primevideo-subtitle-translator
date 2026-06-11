# Publishing to the Chrome Web Store

Step-by-step plan. The package (`dist/extension.zip`) is built by
`scripts/build.sh`.

## 0. Prerequisites
- **Chrome Web Store developer account** — one-time $5 registration:
  https://chrome.google.com/webstore/devconsole
- A **public privacy policy URL** (the Store requires one because the extension
  handles subtitle text). If the repo is private, publish `PRIVACY.md` somewhere
  public (e.g. a public GitHub Gist). Put that URL in the listing.
- The `dist/extension.zip` file (build it: `./scripts/build.sh`).

## 1. Screenshots and graphics
- At least one **1280×800** screenshot (up to 5). Capture the Prime Video player
  with the translation over the subtitles, and the options page.
- The 128×128 icon is already in the package (`icons/icon128.png`).
- (Optional) a 440×280 promo tile.

## 2. Listing copy (ready to paste)

**Name:** `Prime Video Subtitle Translator`

**Summary (≤132 chars):**
`Translate Prime Video subtitles on the fly. Bring your own Google Cloud Translation server. No ads, no trackers.`

**Description:**
```
Translate the built-in subtitles of Prime Video in real time and show the
translation over the player — including fullscreen.

How it works
- The extension reads the subtitle track that you turn on in the player (CC)
  and overlays a translation. It does not transcribe audio.
- Translation runs through your own translation server (a Cloudflare Worker that
  holds a Google Cloud Translation API key). The key never ships in the
  extension, and translation costs stay on your account.

Setup (one time, a few minutes)
1. Open the extension options.
2. Follow the built-in guide to deploy your Cloudflare Worker and get a Google
   Cloud Translation API key.
3. Paste the worker URL into the options. Done.

Features
- Real-time subtitle translation overlay, works in fullscreen
- Choose target language, show original alongside, adjust font size
- Keyboard shortcut to toggle (Alt+Shift+S)
- Local translation cache, no ads, no analytics

Note: works only with text (DOM) subtitles, not image-based ones.
```

**Category:** Tools (or Productivity)
**Language:** English

## 3. Privacy / permissions (Privacy tab in the console)

**Single purpose:**
`Translate Prime Video's on-screen subtitles into another language in real time.`

**Permission justifications:**
- `storage` — stores settings (language, font size, server URL) and a local
  translation cache.
- host `https://*.workers.dev/*` — sends subtitle text to your own Cloudflare
  Worker for translation.
- content script on `https://www.primevideo.com/*` — reads on-screen subtitles
  and renders the translation overlay.
- `commands` — keyboard shortcut to toggle on/off.

**Data usage (what to declare):**
- The extension does **not** collect personal data, history, or credentials.
- Subtitle text is sent **only** to the user-configured translation server. No
  analytics, ads, or remote code.
- Provide the public `PRIVACY.md` URL.

## 4. ⚠️ Note to reviewer (important)
Without a configured server the extension translates nothing — a reviewer may
consider it non-functional. In the **Notes to reviewer** field, provide a test
worker and steps:
```
This extension requires a self-hosted translation proxy. To test:
1. Open the extension options.
2. Paste this temporary test server URL into "Translation server URL": <URL>
3. Open a Prime Video title, turn on subtitles (CC), play — a translated
   overlay appears over the subtitles.
```
(Use a temporary worker URL; you can disable it after review.)

## 5. Upload
1. Console → **Add new item** → upload `dist/extension.zip`.
2. Fill in the listing (section 2), Privacy (section 3), screenshots (section 1).
3. Submit for review. Review usually takes from a few hours to a few days.

## 6. Risks (honest)
- **Amazon ToS.** Automating the player and routing subtitles through a
  third-party translator may conflict with Amazon's terms. The Store may reject
  it or ask for changes. This isn't something code can fix.
- **High barrier to entry.** Requiring users to deploy their own worker rules out
  the mass-market user — in its current form this is a niche, technical tool.
- Change code → bump `version` in `manifest.json`, rebuild, and re-upload.
