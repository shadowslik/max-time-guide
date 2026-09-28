import os
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

TOKEN = os.getenv("MAX_BOT_TOKEN").strip()
BOT_USERNAME = (os.getenv("BOT_USERNAME") or "").strip().lstrip("@")

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