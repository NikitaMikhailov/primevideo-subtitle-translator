# Privacy Policy — Prime Video Subtitle Translator

_Effective date: 2026-06-11_

This extension translates Prime Video subtitles. Below is what data is processed
and where it goes.

## What is processed

- **Subtitle text** of the current video. When a cue is shown, its text is sent
  to a proxy server (a Cloudflare Worker) that **you deploy and configure
  yourself**, which forwards it to the Google Cloud Translation API. There is no
  built-in or shared server: text goes only to your own server.
- **Settings** (target language, font size, server URL, flags) are stored
  locally via `chrome.storage` and synced through your Chrome account.
- **Translation cache** is stored locally in the browser (`chrome.storage.local`).

## What the extension does NOT do

- Does not collect or transmit personal data, browsing history, Amazon
  credentials, cookies, or payment information.
- Contains no ads, analytics, or trackers.
- Sends data to no one except the proxy URL you configure.

## Third parties

Subtitle text passes through:
1. **Your proxy** (Cloudflare Worker) — which you deploy and configure. It is
   under your control.
2. **Google Cloud Translation API** — translation processing is governed by
   Google Cloud's terms (https://cloud.google.com/terms/).

The extension's author does not receive or store your subtitle text — it goes
only to your own server.

## Storage

Cache and settings stay in your browser until you remove the extension or clear
its data. A stateless proxy stores nothing by default.

## Contact

For privacy questions: mikhailov_nikita1997@icloud.com
