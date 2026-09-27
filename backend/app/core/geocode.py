"""Геокодер: MapTiler → fallback Nominatim. coords [lon, lat]."""

from __future__ import annotations

import logging
from typing import List
from urllib.parse import quote

import httpx

from backend.app.config import MAPTILER_KEY
from backend.app.data.places import CITY_CENTER
from backend.app.models.schemas import GeocodeResult

log = logging.getLogger(__name__)
TIMEOUT = 12.0
USER_AGENT = "max-time-guide/1.0"


async def search_address(q: str, limit: int = 6) -> List[GeocodeResult]:
    q = (q or "").strip()
    if len(q) < 3:
        return []

    limit = max(1, min(limit, 10))
    results = await _maptiler(q, limit)
    if results is not None:
        return results
    return await _nominatim(q, limit)


async def _maptiler(q: str, limit: int) -> List[GeocodeResult] | None:
    if not MAPTILER_KEY:
        return None
    lon, lat = CITY_CENTER
    url = f"https://api.maptiler.com/geocoding/{quote(q)}.json"
    params = {
        "key": MAPTILER_KEY,
        "language": "ru",
        "country": "ru",
        "limit": limit,
        "proximity": f"{lon},{lat}",
    }
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            r = await client.get(url, params=params)
            if r.status_code != 200:
                log.warning("maptiler %s", r.status_code)
                return None
            data = r.json()
    except Exception as e:
        log.warning("maptiler fail: %s", e)
        return None

    out: List[GeocodeResult] = []
    for feat in data.get("features") or []:
        geom = feat.get("geometry") or {}
        coords = geom.get("coordinates") or []
        if len(coords) < 2:
            continue
        props = feat.get("properties") or {}
        title = props.get("name") or feat.get("text") or props.get("label") or q
        ctx = props.get("context") or props.get("place_name") or ""
        if isinstance(ctx, list):
            subtitle = ", ".join(
                c.get("text") or c.get("name") or "" for c in ctx if isinstance(c, dict)
            )
        else:
            subtitle = str(ctx) if ctx else "Россия"
        out.append(
            GeocodeResult(
                id=str(feat.get("id") or props.get("id") or f"mt:{title}"),
                title=str(title),
                subtitle=subtitle or "Россия",
                coords=[float(coords[0]), float(coords[1])],
            )
        )
        if len(out) >= limit:
            break
    return out


async def _nominatim(q: str, limit: int) -> List[GeocodeResult]:
    params = {
        "q": f"{q}, Казань",
        "format": "json",
        "limit": limit,
        "addressdetails": 1,
    }
    try:
        async with httpx.AsyncClient(
            timeout=TIMEOUT,
            headers={"User-Agent": USER_AGENT},
        ) as client:
            r = await client.get(
                "https://nominatim.openstreetmap.org/search",
                params=params,
            )
            if r.status_code != 200:
                return []
            data = r.json()
    except Exception as e:
        log.warning("nominatim fail: %s", e)
        return []

    out: List[GeocodeResult] = []
    for item in data:
        try:
            lat = float(item["lat"])
            lon = float(item["lon"])
        except (KeyError, TypeError, ValueError):
            continue
        title = item.get("name") or (item.get("display_name") or q).split(",")[0]
        display = item.get("display_name") or ""
        parts = [p.strip() for p in display.split(",")]
        subtitle = ", ".join(parts[1:3]) if len(parts) > 1 else "Казань"
        out.append(
            GeocodeResult(
                id=f"osm:{item.get('osm_type', 'n')}{item.get('osm_id', len(out))}",
                title=str(title),
                subtitle=subtitle,
                coords=[lon, lat],
            )
        )
    return out
