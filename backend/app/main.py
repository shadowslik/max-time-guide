"""Единая точка входа бэкенда: FastAPI (API мини-аппа) + чат-бот aiomax
в одном процессе, один event loop.

Запуск (из корня репозитория / в Docker):
    python -m backend.app.main
"""

import asyncio
import logging

import uvicorn

from backend.app import config
from backend.app.api.main import app
from backend.app.bot.bot import BotApp

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("main")


async def _run_api():
    server = uvicorn.Server(
        uvicorn.Config(app, host="0.0.0.0", port=8000, log_level="info")
    )
    await server.serve()


async def _run_bot():
    # Бот не должен ронять API: если MAX недоступен (нет сети/токена),
    # логируем и продолжаем крутить только API.
    try:
        await BotApp(config.TOKEN).start()
    except Exception:
        log.exception("Бот остановлен — API продолжает работать")


async def main():
    await asyncio.gather(_run_api(), _run_bot())


if __name__ == "__main__":
    asyncio.run(main())
