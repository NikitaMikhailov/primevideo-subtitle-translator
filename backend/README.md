# Backend proxy (Cloudflare Worker → Google Cloud Translation)

Why it exists: the extension can't ship with a hardcoded Google API key (it would
be extracted from the code). The proxy keeps the key in a secret, and the
extension talks to the proxy. The proxy also adds a CORS restriction (extension
only), rate limiting, and a single place to control spending.

You deploy your **own** proxy and put its URL into the extension options
("Translation server URL"), so Google costs stay on your own account.

## 1. Get a Google Cloud Translation API key

1. Create a project at https://console.cloud.google.com/
2. Enable the **Cloud Translation API**.
3. APIs & Services → Credentials → **Create credentials → API key**.
4. Restrict the key: **API restrictions → Cloud Translation API** (important).
   Leave Application restrictions = "None" — the key lives only in the worker.
5. Make sure **billing** is enabled on the project (the free tier still requires it).

## 2. Deploy the worker

```bash
cd backend
npx wrangler login
npx wrangler secret put GOOGLE_API_KEY   # paste the key from step 1 (hidden)
npx wrangler deploy
```

After `deploy` you get a URL like
`https://pv-subtitle-translator.<subdomain>.workers.dev`.

## 3. Connect it to the extension

Paste that URL into the extension options → **Translation server URL**.
Done — translations now go through your Google Cloud.

## Cost

Google Cloud Translation: first 500,000 characters/month free, then about $20 per
1M characters. Cloudflare Workers: free tier 100,000 requests/day. The extension
caches translations locally, so the real number of requests is well below the
number of subtitle lines.

## Keep spending under control

Set a budget and quota in Google Cloud:
1. Billing → **Budgets & alerts** — set a monthly budget with alerts.
2. APIs & Services → Cloud Translation API → **Quotas** — cap characters/day.

This hard-limits spending in case of abuse. If you ever expose the worker to more
than just yourself, also consider tightening CORS in `worker.js` from any
`chrome-extension://` origin to a specific extension origin:

```js
const ALLOWED_ORIGIN = "chrome-extension://<EXTENSION_ID>";
// use origin === ALLOWED_ORIGIN instead of startsWith(...)
```

Note: the Origin header can be spoofed outside a browser, so CORS only filters
"accidental" traffic — the real safeguard against cost is the budget/quota above.

## Optional: server-side cache

The cache currently lives in the extension (`chrome.storage`). For a cache shared
across users, add a Cloudflare KV namespace and store responses keyed by a hash
of `target+source+text`. This lowers Google costs for popular content.
