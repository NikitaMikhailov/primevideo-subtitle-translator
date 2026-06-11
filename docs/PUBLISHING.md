# Публикация в Chrome Web Store

Пошаговый план. Сборку (`dist/extension.zip`) делает `scripts/build.sh`.

## 0. Что нужно заранее
- **Аккаунт разработчика Chrome Web Store** — разовая регистрация $5:
  https://chrome.google.com/webstore/devconsole
- **Публичный URL политики конфиденциальности** (Store требует его, т.к.
  расширение работает с текстом субтитров). Репозиторий приватный, поэтому
  `PRIVACY.md` нужно выложить публично — например, публичный GitHub Gist или
  любая страница. Вставишь этот URL в листинг.
- Файл `dist/extension.zip` (собрать: `./scripts/build.sh`).

## 1. Скриншоты и графика
- Минимум 1 скриншот **1280×800** (до 5). Сделай кадр плеера Prime Video с
  переводом поверх субтитров и кадр страницы настроек.
- Иконка 128×128 уже в пакете (`icons/icon128.png`).
- (Опц.) промо-плитка 440×280.

## 2. Тексты листинга (готово к вставке, EN)

**Name:** `Prime Video Subtitle Translator`

**Summary (≤132 символов):**
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

**Category:** Tools (или Productivity)
**Language:** English

## 3. Privacy / permissions (вкладка Privacy в консоли)

**Single purpose:**
`Translate Prime Video's on-screen subtitles into another language in real time.`

**Обоснование прав:**
- `storage` — хранит настройки (язык, размер шрифта, адрес сервера) и локальный
  кэш переводов.
- host `https://*.workers.dev/*` — отправляет текст субтитра на ваш собственный
  Cloudflare Worker для перевода.
- content script на `https://www.primevideo.com/*` — читает субтитры на экране и
  рисует оверлей с переводом.
- `commands` — горячая клавиша вкл/выкл.

**Data usage (что отметить):**
- Расширение **не** собирает персональные данные, историю, учётные данные.
- Текст субтитров передаётся **только** на указанный пользователем сервер
  перевода. Нет аналитики, рекламы, удалённого кода.
- Укажи публичный URL `PRIVACY.md`.

## 4. ⚠️ Заметка для ревьюера (важно)
Без настроенного сервера расширение ничего не переводит — ревьюер может счесть
его нерабочим. В поле **Notes to reviewer** дай тестовый воркер и шаги:
```
This extension requires a self-hosted translation proxy. To test:
1. Open the extension options.
2. Paste this temporary test server URL into "Translation server URL": <URL>
3. Open a Prime Video title, turn on subtitles (CC), play — a translated
   overlay appears over the subtitles.
```
(Подставь временный URL воркера; после ревью можешь его выключить.)

## 5. Загрузка
1. Console → **Add new item** → загрузи `dist/extension.zip`.
2. Заполни листинг (раздел 2), Privacy (раздел 3), скриншоты (раздел 1).
3. Submit for review. Ревью обычно от нескольких часов до нескольких дней.

## 6. Риски (честно)
- **ToS Amazon.** Автоматизация плеера и прокачка субтитров через сторонний
  переводчик формально задевают условия Amazon. Store может это отклонить либо
  потребовать правок. Это не решается кодом.
- **Высокий порог входа.** Требование развернуть свой воркер отсекает массового
  пользователя — это нишевый, «для технарей» продукт в текущем виде.
- Меняешь код → подними `version` в `manifest.json`, пересобери и загрузи заново.
