# GATETODATA eSIM — Деплой и выбор хостинга

## 1. Почему НЕ бесплатный Vercel (для текущей архитектуры)

Проект построен как **единый монолит с файловой SQLite-базой** и **ботом на long polling**:

| Ограничение Vercel | Последствие для нас |
|---|---|
| Serverless: файловая система эфемерна | SQLite-файл не сохранится между запросами — заказы потеряются |
| Нет долгоживущих процессов | Бот на long polling не запустится (нужен webhook-режим + переписка под функции) |
| Hobby-план запрещает коммерческое использование | Продажа eSIM формально нарушает ToS Vercel; Pro — $20/мес |
| Cron на Hobby — раз в сутки | Автоподтверждение USDT было бы слишком редким (у нас есть lazy-проверка при поллинге статуса, но 24/7-наблюдатель надёжнее) |

**Вывод:** бесплатный Vercel не подходит для этой версии продукта.

## 2. Рекомендация: недорогой VPS ($4–6/мес) — весь текущий код работает как есть

Один сервер запускает всё: сайт, бота, наблюдателя USDT, SQLite с бэкапами.

| Провайдер | Цена | Примечание |
|---|---|---|
| **Hetzner** (CX22, Финляндия/Германия) | ~€4.5/мес | Лучшее качество/цена, оплата картой |
| **Aeza / ruvds / Timeweb** | ~150–300 ₽/мес | Если удобнее оплата рублями |
| **DigitalOcean / Vultr** | $6/мес | Классика, много локаций |

### Состав сервера
- Node 22, PM2 (3 процесса: web, bot, usdt-watcher)
- Caddy — reverse proxy + бесплатный TLS Let's Encrypt (авто)
- SQLite + ежедневные бэкапы (cron + выгрузка на внешнее хранилище)

### Пошагово (Ubuntu 24.04)

```bash
# 1. Node 22 + PM2
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm i -g pm2

# 2. Код проекта
git clone <ваш-репозиторий> /opt/gatetodata && cd /opt/gatetodata
npm install
cp .env.example .env && nano .env   # прод-ключи; BASE_URL=https://ваш-домен

# 3. Сборка и запуск
npm run build
pm2 start npm --name gd-web -- start
pm2 start npm --name gd-bot -- run bot
pm2 start npm --name gd-watch -- run watch:usdt
pm2 save && pm2 startup    # автозапуск после ребута

# 4. Caddy (HTTPS из коробки)
sudo apt install -y caddy
# /etc/caddy/Caddyfile:
#   ваш-домен.com {
#     reverse_proxy localhost:3010
#   }
sudo systemctl restart caddy

# 5. Бэкапы по cron
crontab -e
#   0 3 * * * cd /opt/gatetodata && npm run backup
```

## 3. Бесплатная альтернатива (если VPS пока нельзя) — Vercel + Turso

Возможна, но требует доработки (~1–2 дня работы):
- SQLite → **Turso** (libSQL, совместим с SQLite; бесплатный тариф достаточен)
- Бот → webhook-режим вместо long polling
- USDT-подтверждения → lazy-проверка при поллинге статуса (уже реализована) + Vercel Cron для страховки
- ⚠️ ToS Vercel Hobby: некоммерческое использование — для продажи всё равно понадобится Pro ($20/мес), что дороже VPS

**Итог:** VPS за $4–6/мес дешевле, проще и полностью соответствует текущей архитектуре. Вариант Vercel+Turso имеет смысл только если принципиально нужен бесплатный старт сайта (не бота).

## 4. Публичный домен

1. Любой регистратор (Namecheap, reg.ru, Cloudflare Registrar) — ~$10/год для .com
2. DNS A-запись на IP вашего VPS
3. Caddy сам получит и обновит TLS-сертификат
4. Обновить в `.env`: `BASE_URL=https://ваш-домен`

## 5. Чек-лист перед боем

- [ ] `TELMO_API_KEY` (live) → `npm run probe` → `npm run sync` (реальный каталог)
- [ ] `npm run seed-demo -- --off` (убрать демо-данные)
- [ ] `USDT_WALLET_ADDRESS` (боевой TRON-кошелёк)
- [ ] `BASE_URL` с доменом (deep links бота, письма)
- [ ] Пароль админки (`ADMIN_PASSWORD`) — длинный, уникальный
- [ ] `SESSION_SECRET` — сгенерировать новый для прода
- [ ] Перевыпустить токен бота через @BotFather (токен светился в чате)
- [ ] Тестовый заказ: Stars → eSIM выдана; USDT → подтверждена
- [ ] `pm2 save` + бэкапы в cron
