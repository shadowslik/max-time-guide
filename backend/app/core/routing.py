"""Прокси OpenRouteService foot-walking → геометрия для карты."""

from __future__ import annotations

import logging
from typing import List, Optional

import httpx

from backend.app.config import ORS_API_KEY
from backend.app.models.schemas import RouteLeg, RouteResponse

log = logging.getLogger(__name__)

ORS_URL = "https://api.openrouteservice.org/v2/directions/foot-walking/geojson"
TIMEOUT = 20.0


async def fetch_route(points: List[List[float]]) -> Optional[RouteResponse]:
    """
    points: [[lon, lat], ...]
    При ошибке — None (фронт рисует пунктир).
    """
    if not ORS_API_KEY or len(points) < 2:
        return None

    body = {"coordinates": points}
    headers = {
        "Authorization": ORS_API_KEY,
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            r = await client.post(ORS_URL, headers=headers, json=body)
            if r.status_code != 200:
                log.warning("ors %s: %s", r.status_code, r.text[:300])
                return None
            data = r.json()
    except Exception as e:
        log.warning("ors fail: %s", e)
        return None

    feats = data.get("features") or []
    if not feats:
        return None

    feat = feats[0]
    coords = (feat.get("geometry") or {}).get("coordinates") or []
    props = feat.get("properties") or {}
    segments = props.get("segments") or []

    legs: List[RouteLeg] = []
    for seg in segments:
        sec = float(seg.get("duration") or 0)
        meters = float(seg.get("distance") or 0)
        legs.append(
            RouteLeg(
                duration=max(1, int(round(sec / 60))),
                length=max(1, int(round(meters))),
            )
        )

    if not legs and coords:
        # один leg на весь путь
        summary = props.get("summary") or {}
        sec = float(summary.get("duration") or 0)
        meters = float(summary.get("distance") or 0)
        legs = [
            RouteLeg(
                duration=max(1, int(round(sec / 60))) if sec else 1,
                length=max(1, int(round(meters))) if meters else 1,
            )
        ]

    line = [[float(c[0]), float(c[1])] for c in coords if len(c) >= 2]
    if not line:
        return None

    return RouteResponse(line=line, legs=legs)
