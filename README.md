# Organic House Cleaning — Free Quote + Clinic Ops (v1)

PWA quote form for **Anne & Rosana** (forest green / cream). Live static host: [computingmadeeasy.org/organic-house-cleaning](https://computingmadeeasy.org/organic-house-cleaning/). GitHub Pages mirror: [freddyja.github.io/organic-house-cleaning](https://freddyja.github.io/organic-house-cleaning/).

This repo also ships **Vercel serverless APIs** for:

1. **Lead capture** — quote form POSTs to `/api/leads`, then still opens `sms:` to **727-379-2528** (fallback if API is down).
2. **Visit / click stats** — anonymous `/api/visits` (path, referrer, truncated UA, optional UTM).
3. **Admin** — password-protected [`/admin.html`](./admin.html): visits, leads (mark contacted), appointments.
4. **Appointment SMS reminders** — day-before ~18:00 and morning-of ~08:00 **America/New_York** via Twilio + Vercel Cron.

## Quick map

| Path | Role |
|------|------|
| `/` `index.html` | Public quote PWA |
| `/admin.html` | Staff dashboard |
| `/api/leads` | POST lead |
| `/api/visits` | POST pageview |
| `/api/admin/login` | POST `{ password }` → token |
| `/api/admin/summary` | GET dashboard data (Bearer token) |
| `/api/admin/leads` | PATCH `{ id, contacted }` |
| `/api/admin/appointments` | GET / POST / DELETE |
| `/api/cron/reminders` | Daily crons ~08:00 / ~18:00 ET (Bearer `CRON_SECRET`) |

`config.js` sets `apiBase` for when the static site is served from CME/Pages (calls Vercel). On `*.vercel.app` it uses same-origin `/api`.

## Required environment variables (Vercel)

| Variable | Required | Purpose |
|----------|----------|---------|
| `ADMIN_PASSWORD` | **Yes** | Admin login |
| `CRON_SECRET` | **Yes** | Protects `/api/cron/reminders` (Vercel sends `Authorization: Bearer …`) |
| `KV_REST_API_URL` | Recommended | Upstash Redis / Vercel KV — durable leads/visits/appointments |
| `KV_REST_API_TOKEN` | Recommended | With URL above |
| `TWILIO_ACCOUNT_SID` | For SMS | Twilio account |
| `TWILIO_AUTH_TOKEN` | For SMS | Twilio auth |
| `TWILIO_FROM` | For SMS | Sending number (E.164, e.g. `+1727…`) |

**Without KV:** APIs still run using **in-memory** storage (fine for a quick smoke test; data is lost on cold starts). Admin UI shows the mode.

**Without Twilio:** Reminder cron returns `{ skipped: true }`; appointments still save.

Do **not** commit real Twilio or KV secrets. Set them in the Vercel project → Settings → Environment Variables.

### Create free Upstash Redis (Vercel KV)

1. In the Vercel dashboard for this project: **Storage** → create **Upstash Redis** / KV.
2. Connect it to the project so `KV_REST_API_URL` and `KV_REST_API_TOKEN` are injected.
3. Redeploy.

### Twilio setup

1. Create a Twilio account and SMS-capable number.
2. Set the three `TWILIO_*` env vars on the project.
3. Hobby plan: two **daily** crons (`0 12 * * *` and `0 22 * * *` UTC ≈ 08:00 / 18:00 Eastern in EDT). Handler uses 7–9 and 17–19 local hour windows.

Reminder template:

> Hi {name}, reminder: Organic House Cleaning is scheduled {when}. Reply or call 727-379-2528 if you need to reschedule. — Anne & Rosana

## Deploy notes

- **GitHub** (`freddyja/organic-house-cleaning`) is the source of truth for the static PWA (CME Web syncs to computingmadeeasy.org).
- **Vercel project** `organic-house-cleaning` hosts the API (+ can also serve the static files).
- Link the GitHub repo in Vercel (**Settings → Git**) after installing the [Vercel GitHub App](https://github.com/apps/vercel), **or** deploy with `vercel --prod` from a machine that has access.
- After the first production URL is known, confirm `config.js` → `apiBase` matches (default `https://organic-house-cleaning.vercel.app`).

### Manual cron test

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://organic-house-cleaning.vercel.app/api/cron/reminders"
```

## Local smoke (optional)

```bash
npx vercel dev
# open http://localhost:3000  and  /admin.html
```

Set `ADMIN_PASSWORD` in `.env.local` for login. Without KV, data is memory-only.

## Branding

Anne & Rosana · forest green `#2D4739` · cream `#F9F8F4` · sage `#98A98E`.
