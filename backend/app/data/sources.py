"""Реальные данные для подбора: места из OpenStreetMap (Overpass) + мероприятия
из KudaGo. Оба источника открытые и бесплатные, без ключей.

Возвращаем словари той же формы, что раньше лежала в data/places.py, чтобы
planner.search_places работал без изменений. priceNote/hours/blurb — всегда
строки (по схеме PlaceOut они обязательны).
"""

from __future__ import annotations

import logging
import math
import time
from typing import List

import httpx

from backend.app.data.places import PLACES  # запасной каталог при сбое OSM

log = logging.getLogger(__name__)

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
KUDAGO_URL = "https://kudago.com/public-api/v1.4/events/"
HEADERS = {"User-Agent": "max-time-guide/1.0 (hackathon)"}  # Overpass без него даёт 406
TIMEOUT = 30.0

# интерес → фильтры Overpass (nwr = node/way/relation)
INTEREST_OSM = {
    "history": ['nwr["historic"]', 'nwr["tourism"="attraction"]'],
    "art": ['nwr["tourism"="gallery"]', 'nwr["tourism"="museum"]'],
    "arch": ['nwr["building"~"cathedral|church|temple|mosque"]', 'nwr["historic"="building"]'],
    "walk": ['nwr["leisure"~"park|garden"]', 'nwr["tourism"="viewpoint"]'],
    "food": ['nwr["amenity"="restaurant"]', 'nwr["amenity"="cafe"]'],
    "photo": ['nwr["tourism"="viewpoint"]', 'nwr["tourism"="attraction"]'],
    "culture": ['nwr["amenity"~"theatre|arts_centre"]', 'nwr["tourism"="museum"]'],
}


def _haversine_m(a, b):
    lon1, lat1 = a
    lon2, lat2 = b
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    h = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def _classify(tags: dict) -> List[str]:
    matched = []
    amenity = tags.get("amenity", "")
    tourism = tags.get("tourism", "")
    leisure = tags.get("leisure", "")
    building = tags.get("building", "")
    if "historic" in tags or tourism == "attraction":
        matched.append("history")
    if tourism in ("gallery", "museum"):
        matched.append("art")
    if building in ("cathedral", "church", "temple", "mosque") or tags.get("historic") == "building":
        matched.append("arch")
    if leisure in ("park", "garden") or tourism == "viewpoint":
        matched.append("walk")
    if amenity in ("restaurant", "cafe"):
        matched.append("food")
    if tourism in ("viewpoint", "attraction"):
        matched.append("photo")
    if amenity in ("theatre", "arts_centre") or tourism == "museum":
        matched.append("culture")
    return list(dict.fromkeys(matched))


def _visit_time(tags: dict):
    amenity = tags.get("amenity", "")
    tourism = tags.get("tourism", "")
    leisure = tags.get("leisure", "")
    if amenity in ("restaurant", "cafe"):
        return 60, 40
    if tourism in ("museum", "gallery") or amenity in ("theatre", "arts_centre"):
        return 60, 30
    if leisure in ("park", "garden"):
        return 40, 20
    if tourism == "viewpoint":
        return 20, 10
    return 30, 15


def fetch_osm_places(start, interests, radius_m=1800, limit=60) -> List[dict]:
    ids = [i for i in (interests or []) if i in INTEREST_OSM]
    keys = ids or list(INTEREST_OSM.keys())
    filters = []
    for k in keys:
        filters.extend(INTEREST_OSM[k])
    filters = list(dict.fromkeys(filters))

    lon, lat = start
    body = "".join(f"{f}(around:{radius_m},{lat},{lon});" for f in filters)
    query = f"[out:json][timeout:25];({body});out center {limit * 3};"

    with httpx.Client(timeout=TIMEOUT, headers=HEADERS) as client:
        r = client.post(OVERPASS_URL, data={"data": query})
        r.raise_for_status()
        elements = r.json().get("elements", [])

    requested = set(ids)
    places, seen = [], set()
    for e in elements:
        tags = e.get("tags", {})
        name = tags.get("name")
        plat = e.get("lat") or (e.get("center") or {}).get("lat")
        plon = e.get("lon") or (e.get("center") or {}).get("lon")
        if not name or plat is None or plon is None:
            continue

        matched = _classify(tags)
        if requested:
            matched = [i for i in matched if i in requested]
            if not matched:
                continue

        key = (name, round(plon, 4), round(plat, 4))
        if key in seen:
            continue
        seen.add(key)

        ideal, mn = _visit_time(tags)
        highlights = []
        if tags.get("cuisine"):
            highlights.append(tags["cuisine"].replace(";", ", "))
        places.append({
            "id": f"{e['type']}/{e['id']}",
            "name": name,
            "short": name,
            "interests": matched,
            "price": "бесплатно" if tags.get("fee") == "no" else "уточняйте",
            "priceNote": "",
            "hours": tags.get("opening_hours") or "",
            "blurb": tags.get("description") or "",
            "highlights": highlights,
            "coords": [float(plon), float(plat)],
            "idealVisit": ideal,
            "minVisit": mn,
        })
        if len(places) >= limit:
            break
    return places


def fetch_kudago_events(start, city="kzn", radius_m=2500, limit=20) -> List[dict]:
    params = {
        "location": city,
        "actual_since": int(time.time()),
        "fields": "id,title,dates,place,price,is_free,description,categories",
        "expand": "place",
        "page_size": 100,
        "order_by": "-rank",
        "text_format": "text",
    }
    try:
        with httpx.Client(timeout=20.0, headers=HEADERS) as client:
            r = client.get(KUDAGO_URL, params=params)
            r.raise_for_status()
            items = r.json().get("results", [])
    except Exception as e:
        log.warning("kudago fail: %s", e)
        return []

    out = []
    for it in items:
        place = it.get("place") or {}
        coords = place.get("coords") or {}
        lat, lon = coords.get("lat"), coords.get("lon")
        if lat is None or lon is None:
            continue
        if _haversine_m(start, [lon, lat]) > radius_m:
            continue
        cats = it.get("categories") or []
        interests = ["culture"]
        if any(c in ("exhibitions", "art") for c in cats):
            interests.append("art")
        title = (it.get("title") or "Событие").capitalize()
        price = it.get("price") or ""
        out.append({
            "id": f"event/{it['id']}",
            "name": title,
            "short": title,
            "interests": interests,
            "price": "бесплатно" if it.get("is_free") else (price or "уточняйте"),
            "priceNote": price if not it.get("is_free") else "",
            "hours": "",
            "blurb": (it.get("description") or "").strip(),
            "highlights": ["Событие"],
            "coords": [float(lon), float(lat)],
            "idealVisit": 60,
            "minVisit": 30,
        })
        if len(out) >= limit:
            break
    return out


def fetch_places(start, interests) -> List[dict]:
    """Места (OSM) + мероприятия (KudaGo). При сбое OSM — запасной каталог."""
    try:
        places = fetch_osm_places(start, interests)
    except Exception as e:
        log.warning("overpass fail, fallback to static PLACES: %s", e)
        places = list(PLACES)
    events = fetch_kudago_events(start)
    return places + events
