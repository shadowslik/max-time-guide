import os
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

# Токен бота может отсутствовать при локальной разработке (когда бот не нужен) —
# тогда не падаем на импорте, а просто отдаём пустую строку. Сам бот при пустом
# токене не стартует (см. main.py / RUN_BOT).
TOKEN = (os.getenv("MAX_BOT_TOKEN") or "").strip()
BOT_USERNAME = (os.getenv("BOT_USERNAME") or "").strip().lstrip("@")

# Поднимать ли чат-бота MAX вместе с API. Локально удобно отключать (RUN_BOT=0),
# чтобы локальный бот не конкурировал за апдейты с ботом на сервере.
RUN_BOT = (os.getenv("RUN_BOT") or "1").strip().lower() not in ("0", "false", "no", "")

# Порт API (по умолчанию 8000; на него же смотрит прокси Vite в dev).
API_PORT = int((os.getenv("API_PORT") or "8000").strip())

ORS_API_KEY = (
    os.getenv("VITE_ORS_API_KEY")
    or ""
).strip()

MAPTILER_KEY = (os.getenv("VITE_MAPTILER_KEY") or "").strip()

# DaData — подсказки российских адресов (улица → дом), бесплатный тариф
DADATA_TOKEN = (os.getenv("DADATA_TOKEN") or "").strip()

# 2ГИС Catalog API — места по категориям и радиусу по всей РФ (основной источник мест)
TWOGIS_KEY = (os.getenv("TWOGIS_KEY") or "").strip()

# Культура.РФ / PRO.Культура.РФ — культурные события + «Пушкинская карта» (по ключу)
CULTURE_API_KEY = (os.getenv("CULTURE_API_KEY") or "").strip()