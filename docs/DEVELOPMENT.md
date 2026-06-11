# Разработка

## Архитектура

```
content.js ──(текст субтитра)──▶ background.js ──HTTPS──▶ Cloudflare Worker ──▶ Google Cloud Translation
   ▲ MutationObserver                │ кэш + ретраи           │ держит API-ключ
   └──(оверлей с переводом)──────────┘                        └ CORS только для расширения
```

- **content.js** — через `MutationObserver` ловит изменения встроенных субтитров
  (`.atvwebplayersdk-captions-text`), прячет их (`opacity:0`, чтобы оставались
  читаемыми) и рисует свой оверлей с переводом. В полноэкранном режиме оверлей
  переезжает внутрь `document.fullscreenElement`.
- **background.js** (service worker) — шлёт текст на прокси, делает ретраи с
  backoff и хранит постоянный кэш переводов в `chrome.storage.local`. Адрес
  прокси: свой из настроек, иначе `DEFAULT_PROXY_URL`.
- **backend/worker.js** — прокси к Google Cloud Translation v2 (см.
  [`../backend/README.md`](../backend/README.md)).

## Карта файлов

| Файл | Назначение |
|------|------------|
| `manifest.json` | Манифест MV3 |
| `content.js` | Чтение субтитров, оверлей, observer'ы |
| `background.js` | Прокси-вызовы, кэш, ретраи |
| `overlay.css` | Стиль оверлея перевода |
| `popup.html/.css/.js` | Настройки |
| `icons/` | Иконки 16/48/128 |
| `backend/worker.js` | Cloudflare Worker (прокси) |
| `backend/wrangler.toml` | Конфиг деплоя воркера |

## Локальная разработка

1. `chrome://extensions/` → Developer mode → **Load unpacked** → корень репо.
2. После правки `content.js`/`background.js`/попапа жми **↻ reload** на карточке
   расширения (перезагрузка вкладки код расширения НЕ обновляет), затем Cmd+R на
   вкладке с видео.
3. Если reload не подхватывает изменения — **Remove** + **Load unpacked** заново.

### Две консоли
- **content-скрипт**: F12 на вкладке primevideo → Console.
- **background**: `chrome://extensions/` → у расширения ссылка «service worker».
  Здесь же можно тестировать прокси (контекст расширения проходит CORS):
  ```js
  fetch(DEFAULT_PROXY_URL || 'https://<твой>.workers.dev', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({texts:['Hello world'], target:'ru'})
  }).then(r=>r.text().then(t=>console.log(r.status, t)));
  ```

## Диагностический сниппет (консоль страницы)

```js
JSON.stringify({
  contentScriptActive: !!document.getElementById('pvst-hide-native'),
  overlayText: document.getElementById('pvst-overlay')?.innerText || null,
  nativeText: [...document.querySelectorAll('.atvwebplayersdk-captions-text')].map(n=>n.innerText),
  nativeOpacity: getComputedStyle(document.querySelector('.atvwebplayersdk-captions-text')||document.body).opacity
}, null, 2)
```

## Тестирование (ключевые сценарии)

| Сценарий | Ожидание |
|----------|----------|
| Смена языка в попапе на лету | Следующая реплика — на новом языке |
| Полноэкранный режим | Перевод виден (оверлей внутри fullscreen-элемента) |
| Переход на следующий эпизод | Перевод продолжает работать без перезагрузки |
| CC выключены | Оверлей пуст; через ~25с предупреждение health-check в консоли |
| Прокси недоступен / 429 | Показывается оригинал; ретраи с backoff, без шторма запросов |
| Перемотка на повтор | Мгновенно из кэша, без новых запросов |

## Устойчивость к изменениям Amazon

Классы вида `f7j034j` обфусцированы и меняются между релизами. Код опирается на
стабильный `atvwebplayersdk-captions-text`. Если разметка изменится — в консоли
появится предупреждение health-check; обнови `CAPTION_SELECTOR` в `content.js`.
