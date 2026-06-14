# Changelog

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [1.1.0] - 2026-06-14

### Changed
- Subtitles are now translated **per line, progressively**. Each cue is split
  into its natural lines, every line is translated independently and in
  parallel, and the overlay shows the original immediately then swaps in each
  translation as it arrives. Long captions that used to disappear before their
  translation rendered now always show something right away.

## [1.0.1] - 2026-06-11

### Added
- Keyboard shortcut **Alt+Shift+S** to toggle translation on/off, with an
  on-screen ON/OFF toast.
- Options page with a "Translation server URL" field and an inline step-by-step
  self-hosting guide.
- GitHub Actions CI: `node --check` on all scripts + `manifest.json` validation.
- `scripts/build.sh` to produce `dist/extension.zip`; `docs/PUBLISHING.md`,
  `docs/DEVELOPMENT.md`, `LICENSE` (MIT), `CHANGELOG.md`.

### Changed
- The whole project (extension UI, messages, code comments, and docs) is in
  English.
- Removed the built-in default proxy: each user configures **their own**
  translation server. When none is set, the overlay prompts to configure one.
- The proxy field moved from the popup to the options page (the popup now links
  to it).

### Fixed
- Fullscreen: the overlay is moved into `document.fullscreenElement`, otherwise
  the translation was occluded by the fullscreen top layer.
- Auto-detect: stopped sending `source:"auto"` (rejected by Google v2) — the
  parameter is omitted instead.
- Worker trims the API key secret in case a space/newline slipped in.

## [1.0.0]

### Added
- Real-time translation of Prime Video's built-in subtitles (Chrome MV3).
- Subtitle reading via `MutationObserver`, translation overlay over the player.
- Backend proxy (Cloudflare Worker → Google Cloud Translation).
- Persistent translation cache, retries with backoff, selector health-check.
- Settings: target language, show original, font size.
