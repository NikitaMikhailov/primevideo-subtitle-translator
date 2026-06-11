# Бэкенд-прокси (Cloudflare Worker → Google Cloud Translation)

Зачем нужен: расширение в Web Store нельзя публиковать с зашитым API-ключом
Google (его извлекут из кода). Прокси держит ключ в секрете, а расширение
обращается к прокси. Заодно прокси даёт CORS-ограничение (только наше
расширение), rate-limit и единую точку контроля расходов.

## 1. Получить ключ Google Cloud Translation

1. Создай проект в https://console.cloud.google.com/
2. Включи **Cloud Translation API**.
3. APIs & Services → Credentials → **Create credentials → API key**.
4. Ограничь ключ: **API restrictions → Cloud Translation API** (важно).
   Application restriction оставь «None» — ключ всё равно живёт только в воркере.

## 2. Задеплоить воркер

```bash
cd backend
npx wrangler login
npx wrangler secret put GOOGLE_API_KEY   # вставить ключ из шага 1
npx wrangler deploy
```

После `deploy` ты получишь URL вида
`https://pv-subtitle-translator.<subdomain>.workers.dev`.

## 3. Подключить к расширению

Скопируй этот URL в попап расширения → поле **«Адрес прокси»**.
Готово — переводы пойдут через Google Cloud.

## Стоимость

Google Cloud Translation: первые 500 000 символов/мес бесплатно, далее ~$20 за
1 млн символов. Cloudflare Workers: бесплатный тариф 100 000 запросов/день.
Расширение кэширует переводы локально, так что реальное число запросов
заметно ниже числа реплик.

## Опционально: постоянный кэш на стороне прокси

Сейчас кэш живёт на стороне расширения (`chrome.storage`). Если хочешь общий
кэш на всех пользователей — добавь Cloudflare KV namespace и кэшируй ответы по
хэшу `target+source+text`. Это снизит расходы на Google при популярном контенте.
