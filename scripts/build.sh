#!/usr/bin/env bash
# Builds the Chrome Web Store package: dist/extension.zip
# Includes only the files the extension needs (no backend/docs/git).
set -euo pipefail

cd "$(dirname "$0")/.."

FILES=(
  manifest.json
  content.js
  background.js
  popup.html
  popup.css
  popup.js
  options.html
  options.js
  overlay.css
  icons
)

# sanity: every referenced file exists
for f in "${FILES[@]}"; do
  [ -e "$f" ] || { echo "missing: $f" >&2; exit 1; }
done

VERSION=$(node -e "console.log(require('./manifest.json').version)")
OUT="dist/extension.zip"

rm -rf dist
mkdir -p dist
zip -r -X "$OUT" "${FILES[@]}" >/dev/null

echo "Built $OUT (v$VERSION)"
unzip -l "$OUT" | tail -n +2
