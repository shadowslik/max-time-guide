"""Хранилище на SQLite (stdlib, без внешних сервисов и доп. зависимостей).

Файл БД лежит в backend/data/app.db (в Docker — том, чтобы данные переживали
пересборку). Путь можно переопределить переменной окружения DB_PATH.
"""

from __future__ import annotations

import os
import sqlite3
import threading
from pathlib import Path

_DEFAULT = Path(__file__).resolve().parents[2] / "data" / "app.db"
DB_PATH = os.getenv("DB_PATH") or str(_DEFAULT)

_LOCK = threading.Lock()
_CONN: sqlite3.Connection | None = None


def _connect() -> sqlite3.Connection:
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS trips (
            id         TEXT PRIMARY KEY,
            user_id    TEXT NOT NULL,
            place      TEXT,
            place_id   TEXT,
            city       TEXT,
            date       TEXT,
            minutes    INTEGER,
            walk_to    INTEGER,
            visit      INTEGER,
            walk_back  INTEGER,
            interests  TEXT,
            created_at TEXT
        )
        """
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_trips_user ON trips(user_id, created_at)")
    conn.commit()
    return conn


def conn() -> sqlite3.Connection:
    # Ленивая инициализация. Вызывается уже под _LOCK (из execute/query), поэтому
    # сам лок здесь НЕ берём — иначе повторный захват нереентрабельного лока
    # приводит к вечному зависанию на первом обращении к БД.
    global _CONN
    if _CONN is None:
        _CONN = _connect()
    return _CONN


def execute(sql: str, params: tuple = ()):
    with _LOCK:
        c = conn()
        cur = c.execute(sql, params)
        c.commit()
        return cur


def query(sql: str, params: tuple = ()) -> list[sqlite3.Row]:
    with _LOCK:
        return conn().execute(sql, params).fetchall()
