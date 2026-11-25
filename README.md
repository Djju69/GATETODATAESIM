# GATETODATA eSIM

Международный магазин туристических eSIM: сайт + Telegram-бот + админка в одном приложении.
Поставщик: **TELMO eSIM** (реселлерская модель, prepaid-кошелёк, свои розничные цены).

## Стек

- **Next.js 15 + TypeScript + Tailwind** — витрина, админка, API
- **SQLite (better-sqlite3, WAL)** — база, нулевая стоимость
- **grammY** — Telegram-бот (long polling)
- Оплата: **Telegram Stars** и **USDT TRC-20** (авто-подтверждение через TronGrid)

## Быстрый старт

```bash
# 1. Зависимости
npm install

# 2. Конфигурация
cp .env.example .env
# заполните: TELMO_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME,
#            USDT_WALLET_ADDRESS, ADMIN_TELEGRAM_ID, ADMIN_PASSWORD, SESSION_SECRET

# 3. Проверка API TELMO (реальные endpoint'ы по вашему ключу)
npm run probe

# 4. Синхронизация каталога (реальные пакеты и себестоимость из TELMO)
npm run sync

# 5. Запуск сайта + бота (в двух терминалах)
npm run dev        # сайт: http://localhost:3000
npm run bot        # Telegram-бот

# 6. Наблюдатель USDT-платежей (третий терминал, или cron)
npm run watch:usdt
```

## Команды

| Команда | Описание |
|---|---|
| `npm run dev` | сайт в dev-режиме |
| `npm run build && npm start` | прод-сборка |
| `npm run bot` | Telegram-бот (long polling) |
| `npm run probe` | диагностика endpoint'ов TELMO |
| `npm run sync` | синхронизация каталога + пересчёт розничных цен |
| `npm run watch:usdt` | фоновая сверка USDT-платежей |
| `npm run backup` | бэкап SQLite (cron: раз в сутки) |
| `npm run typecheck` | проверка типов |

## Архитектура

```
src/
├─ app/                 # Next.js: витрина, checkout, выдача eSIM, админка, API
│  ├─ (storefront)      # /, /countries, /regions, /global, /plan/[id]
│  ├─ checkout/[id]     # оформление + USDT-инвойс
│  ├─ esim/[token]      # выдача: QR, LPA, инструкции
│  ├─ admin/            # дашборд, заказы, цены, промокоды, ошибки
│  └─ api/              # заказы, промо, оплата, admin login
├─ core/                # домен (без Next): БД, заказы, промо, платежи, провайдер
│  ├─ providers/telmo.ts  # TELMO-адаптер (единственное место с деталями API)
│  ├─ payments/           # stars.ts, usdt.ts
│  └─ orders.ts           # state machine: AWAITING_PAYMENT → PAID → DELIVERED
└─ bot/                 # Telegram-бот (grammY)
```

Ключевые принципы:
- **eSIM выдаётся только после подтверждённого платежа** (state machine + идемпотентные webhook-и).
- **Витрина читает свою БД** — каталог синхронизируется с поставщиком, недоступность API не ломает магазин.
- **Новый поставщик = новый адаптер** `EsimProvider`, остальное не меняется.
- **Секреты только в .env** (в репозитории — только .env.example).

## Документация

- `docs/01-ANALYSIS.md` — анализ рынка, TELMO, платежи, риски
- `docs/02-ARCHITECTURE.md` — архитектура, схема БД, дизайн-система, карта страниц
- `docs/03-PLAN.md` — план и статус этапов
- `docs/04-QUESTIONS.md` — вопросы к поставщику и владельцу

## Деплой на Vercel (бесплатно)

1. Код уже в GitHub → на [vercel.com](https://vercel.com) → **Add New Project → Import** репозиторий.
2. Framework: Next.js (определится сам). **Environment Variables** (Settings → Environment Variables):
   - `DATABASE_URL` — Supabase Postgres (Connection string)
   - `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET` (любая случайная строка)
   - `ADMIN_PASSWORD`, `SESSION_SECRET`, `BASE_URL=https://<проект>.vercel.app`
   - `TELMO_API_KEY` (когда появится), `USDT_WALLET_ADDRESS`
   - `CRON_SECRET` (случайная строка — защищает /api/cron/usdt)
3. Deploy → временный домен `https://<проект>.vercel.app` готов.
4. Подключить бота к webhook: локально `npm run set-webhook https://<проект>.vercel.app`
   (или через BotFather /setwebhook → `https://<проект>.vercel.app/api/telegram`).
5. Каталог: заполнен через `npm run sync` локально — на Vercel используется та же БД Supabase.

## Деплой на VPS (альтернатива)

1. VPS 1 vCPU/1GB, Node 22, PM2: `pm2 start "npm start" --name gd-web` + `pm2 start "npm run bot" --name gd-bot` + `pm2 start "npm run watch:usdt" --name gd-watch`
2. Caddy reverse proxy → localhost:3010 (авто-TLS)
3. cron: `0 3 * * * cd /app && npm run backup`
4. `.env` с прод-ключами; `BASE_URL` с доменом

Подробности: `docs/05-DEPLOY.md`, `docs/06-MIGRATION-SUPABASE.md`.
