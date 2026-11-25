# Миграция на бесплатный хостинг: Vercel + Supabase Postgres

> **Статус: выполнена** (25.11.2026). Слой БД переведён на Postgres (postgres.js, пуллер `aws-0-ap-southeast-1`),
> схема создана в Supabase автоматически, лучше-sqlite3 удалён из зависимостей.
> Бот на Vercel переводится в webhook-режим (`/api/telegram`) — заготовка ниже.

## Целевая схема (все компоненты на бесплатных тарифах)

```
Vercel (Next.js: витрина + API + админка + бот в webhook-режиме)
   │
   ├── Supabase Postgres  ← вся БД (клиенты, заказы, каталог, промо, аудит)
   ├── Telegram API       ← webhook вместо long polling
   └── TronGrid           ← USDT-подтверждения (lazy при поллинге статуса + cron-страховка)
```

## Что меняется в коде

| Компонент | Сейчас | Станет |
|---|---|---|
| БД | SQLite (better-sqlite3), файл | **Supabase Postgres** (postgres.js), cloud |
| Драйвер | синхронный | асинхронный → все функции домена становятся `async` |
| Бот | long polling (`bot.start()`) | **webhook** на `/api/telegram` (grammY `webhookCallback`) |
| USDT-наблюдатель | отдельный процесс | lazy-проверка при запросе статуса (уже есть) + Vercel Cron |
| Бэкапы | cron sqlite .backup | Supabase делает бэкапы сам + `pg_dump` скрипт |

SQL-различия SQLite → Postgres, которые правятся точечно:
- `?` → `$1, $2…` в сырых запросах (ядро изолировано в db.ts/репозиториях)
- `datetime('now','-10 minutes')` → `now() - interval '10 minutes'`
- `json_extract(x,'$.y')` → `x->>'y'`
- `json_each` → `jsonb_array_elements`
- `PRAGMA` → не нужны; `SERIAL`/`timestamptz` типы

## Что нужно от владельца

1. **Supabase**: Project Settings → Database → Connection string → **URI** (с паролем).
   Для Vercel лучше **Connection Pooling** (порт 6543, `?pgbouncer=true`).
   Формат: `postgresql://postgres.[ref]:[PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres`
2. **Vercel**: бесплатный аккаунт → New Project → подключить Git-репозиторий.

## Шаги миграции (выполняет агент)

1. `db.ts`: драйвер postgres.js + async-помощники (get/all/run/tx) + Postgres-DDL.
2. Прогон `tsc` → исправление всех call-sites (await-цепочка по core/bot/app).
3. Бот: `src/bot/webhook.ts` + `app/api/telegram/route.ts` (`webhookCallback`).
4. Скрипты probe/sync/backup → под Postgres.
5. `.env`: `DATABASE_URL` (Supabase), TELEGRAM_WEBHOOK_SECRET; Vercel → Environment Variables.
6. Тест: локально через Supabase-подключение → деплой на Vercel → `setWebhook`.

## Ограничения/нюансы

- ⚠️ ToS Vercel Hobby — некоммерческое использование; для магазина формально нужен Pro ($20/мес).
  Компромисс на старте: бесплатный тариф → при первых продажах переехать на VPS (код совместим: Postgres работает и там) либо оплатить Pro.
- Long polling исчезает: бот отвечает через webhook — поведение для пользователя то же.
- Фиксированные интервалы (`setInterval` для USDT) заменяются на проверку «по факту» + Cron.
