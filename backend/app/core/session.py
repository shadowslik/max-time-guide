"""Сессия MAX: разбор initData (упрощённо для MVP).

Полная проверка HMAC — по доке MAX; пока извлекаем user без жёсткого fail,
если подпись не проверяем (нет токена / dev).
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
from typing import Optional
from urllib.parse import parse_qsl

from backend.app.config import TOKEN
from backend.app.data.places import CITY_NAME
from backend.app.models.schemas import SessionResponse

log = logging.getLogger(__name__)


def _parse_init(init_data: str) -> dict:
    return dict(parse_qsl(init_data, keep_blank_values=True))


def verify_init_data(init_data: str) -> bool:
    """Telegram/MAX-style: HMAC-SHA256 отсортированных полей."""
    if not TOKEN or not init_data:
        return False
    try:
        parsed = _parse_init(init_data)
        recv_hash = parsed.pop("hash", None)
        if not recv_hash:
            return False
        data_check = "\n".join(f"{k}={v}" for k, v in sorted(parsed.items()))
        secret = hmac.new(b"WebAppData", TOKEN.encode(), hashlib.sha256).digest()
        calc = hmac.new(secret, data_check.encode(), hashlib.sha256).hexdigest()
        return hmac.compare_digest(calc, recv_hash)
    except Exception as e:
        log.warning("initData verify fail: %s", e)
        return False


def open_session(init_data: str, strict: bool = False) -> Optional[SessionResponse]:
    parsed = _parse_init(init_data or "")
    if strict and not verify_init_data(init_data):
        return None

    user_raw = parsed.get("user")
    user_id = "max:anonymous"
    name = "Гость"
    if user_raw:
        try:
            user = json.loads(user_raw)
            uid = user.get("id") or user.get("user_id")
            if uid is not None:
                user_id = f"max:{uid}"
            name = (
                user.get("first_name")
                or user.get("name")
                or user.get("username")
                or name
            )
        except json.JSONDecodeError:
            pass

    return SessionResponse(userId=user_id, displayName=str(name), city=CITY_NAME)
