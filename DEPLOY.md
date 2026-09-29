# Развёртывание

Весь стек (Caddy + frontend + backend) поднимается через Docker Compose — и локально, и на сервере, одной командой.

## Локально

```bash
cp .env.example .env   # заполнить MAX_BOT_TOKEN, TWOGIS_KEY, DADATA_TOKEN
docker compose up --build
```

Открыть **http://localhost**. Caddy проксирует `/api/*` на backend, остальное — на статику фронта. Порты контейнеров наружу пробрасывать не нужно.

> Бот стартует с тем же `MAX_BOT_TOKEN`, что и на сервере — перед локальным запуском останови серверного бота (иначе оба тянут одни апдейты MAX) или поставь `RUN_BOT=0` в `.env`.

## На сервере (VPS)

Развёрнуто на VPS за Caddy с автоматическим HTTPS (Let's Encrypt) по адресу `https://168.113.157.47.sslip.io` (домен задан в [Caddyfile](Caddyfile)).

Первый запуск:

```bash
git clone <repo> max-time-guide && cd max-time-guide
cp .env.example .env   # заполнить секреты
docker compose up -d --build
```

Обновление после пуша:

```bash
cd max-time-guide && git pull && docker compose up -d --build
```

Смена домена — поправить адрес в [Caddyfile](Caddyfile) (первый блок) и перезапустить `caddy`.

## Остановка и перезапуск

```bash
docker compose down     # остановить
docker compose up -d     # поднять снова (данные профиля переживают: том backend_data)
```

## Правила

- `.env` с рабочими токенами **не коммитим** (в `.gitignore`); в репозитории только `.env.example` без секретов.
- `dist/` и `node_modules/` не коммитим.
- Перед пушем убедись, что сборка проходит: `docker compose build` (или `cd frontend && npm run build`).
