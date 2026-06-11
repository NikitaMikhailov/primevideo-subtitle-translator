# Prime Video Subtitle Translator

Chrome-расширение (Manifest V3), которое переводит встроенные субтитры Prime Video
на лету и показывает перевод поверх плеера. Без рекламы, без трекеров.

Перевод идёт через **Google Cloud Translation** за вашим собственным
прокси-сервером (Cloudflare Worker), который держит API-ключ — поэтому ключ не
попадает в код расширения. Это и есть production-схема, пригодная для Chrome
Web Store.

## Архитектура

```
content.js ──(текст субтитра)──▶ background.js ──HTTPS──▶ Cloudflare Worker ──▶ Google Cloud Translation
   ▲ MutationObserver                │ кэш + ретраи            │ держит API-ключ
   └──(оверлей с переводом)──────────┘                         └ CORS только для расширения
```

- `content.js` через **MutationObserver** ловит изменения субтитров
  (`.atvwebplayersdk-captions-text`), прячет родные (`opacity:0`, чтобы их можно
  было читать) и рисует свой оверлей с переводом.
- `background.js` ходит в прокси, делает **ретраи с backoff** и хранит
  **постоянный кэш** переводов в `chrome.storage.local`.
- `backend/worker.js` — прокси к Google Cloud Translation (см. `backend/README.md`).

## Установка прокси (обязательно)

Без прокси переводить нечем. Полная инструкция — в [`backend/README.md`](backend/README.md):

```bash
cd backend
npx wrangler login
npx wrangler secret put GOOGLE_API_KEY   # ключ Cloud Translation API
npx wrangler deploy                       # выдаст https://...workers.dev
```

## Установка расширения

1. `chrome://extensions/` → включить **Developer mode**.
2. **Load unpacked** → выбрать папку `primevideo_translator`.
3. Открыть попап расширения → вставить адрес прокси из деплоя воркера.

## Использование

1. Открыть видео на https://www.primevideo.com/.
2. Включить субтитры (CC) в плеере — расширение переводит **существующую**
   дорожку субтитров (распознавания речи нет).
3. В попапе выбрать язык перевода (по умолчанию русский).

## Настройки (попап)

- Включить перевод · Язык перевода · Показывать оригинал · Размер шрифта · Адрес прокси.

## Заметки для разработчика

- Классы вида `f7j034j` обфусцированы и меняются; код опирается на стабильный
  `atvwebplayersdk-captions-text`. Если Amazon сменит разметку — в консоли
  появится предупреждение health-check; обнови `CAPTION_SELECTOR` в `content.js`.
- Работает только с текстовыми (DOM) субтитрами; «вшитые» в видеоряд — нельзя.
- `PRIVACY.md` — политика конфиденциальности для листинга в Web Store.

## Что осталось до релиза в Web Store

- Заменить плейсхолдер-иконки на дизайнерские (текущие сгенерированы программно).
- Разместить `PRIVACY.md` по публичному URL и указать его в листинге.
- Учесть, что автоматизация Prime Video и прокачка субтитров через сторонний
  переводчик формально задевают ToS Amazon.
