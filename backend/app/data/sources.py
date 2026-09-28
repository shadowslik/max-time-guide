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
from typing import List, Optional

import httpx

from backend.app.data.places import PLACES  # запасной каталог — только рядом с Казанью

log = logging.getLogger(__name__)

# Зеркала Overpass: если одно недоступно/лимитит — идём к следующему. Без этого
# один сбой overpass-api.de ронял поиск в запасной каталог другого города.
OVERPASS_URLS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]
KUDAGO_URL = "https://kudago.com/public-api/v1.4/events/"
# Культура.РФ / ЕИПСК — события по всей России (в т.ч. там, где нет KudaGo).
CULTURE_URLS = [
    "https://all.culture.ru/api/2.2/events",
    "https://all.culture.ru/api/2.1/events",
]
HEADERS = {"User-Agent": "max-time-guide/1.0 (hackathon)"}  # Overpass без него даёт 406
TIMEOUT = 50.0  # больше серверного [timeout:40], иначе рвём соединение раньше ответа

# Параметры пешей досягаемости — те же, что в планировщике.
WALK_SPEED = 4.8  # км/ч
DETOUR = 1.3      # реальный путь длиннее прямой
MIN_VISIT = 15    # хотя бы короткий заход
BUFFER = 10

# Казань — единственный город, для которого есть статический каталог. Дальше
# него им подменять нельзя, иначе человек в другом городе видит места Казани.
KAZAN = (49.1221, 55.7887)

# Набор интересов, которые вообще умеем распознавать (для валидации запроса).
INTERESTS = ("history", "art", "arch", "walk", "food", "photo", "culture")

# Компактный набор фильтров Overpass: несколько regex-запросов вместо десятка
# отдельных around-ов — иначе запрос слишком тяжёлый и зеркала отвечают 504.
# Отбор по конкретным интересам делает уже _classify после загрузки.
OSM_SELECTORS = [
    'nwr["historic"]',
    'nwr["tourism"~"gallery|museum|artwork|attraction|viewpoint|picnic_site"]',
    'nwr["building"~"cathedral|church|temple|mosque"]',
    'nwr["leisure"~"park|garden|nature_reserve"]',
    'nwr["amenity"~"restaurant|cafe|theatre|arts_centre"]',
]

# Города, которые знает KudaGo (slug → центр lon,lat). Для остального — без событий.
KUDAGO_CITIES = {
    "msk": (37.6176, 55.7558), "spb": (30.3141, 59.9386), "nsk": (82.9204, 55.0084),
    "ekb": (60.5975, 56.8389), "nnv": (44.0020, 56.3269), "kzn": (49.1221, 55.7887),
    "vbg": (28.7505, 60.7076), "smr": (50.1500, 53.2001), "krd": (38.9769, 45.0448),
    "sochi": (39.7303, 43.6028), "ufa": (55.9721, 54.7431), "krasnoyarsk": (92.8672, 56.0153),
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


def _reachable_radius_m(minutes: int) -> int:
    """До какой точки можно уйти в одну сторону, чтобы успеть дойти, коротко
    зайти и вернуться. Радиус растёт со временем — за 3 часа ищем шире, чем за час.
    """
    road = max(10, int(minutes) - MIN_VISIT - BUFFER)  # минуты на дорогу туда-обратно
    dist_km = road / 2 * (WALK_SPEED / 60) / DETOUR     # одна сторона, с учётом петляния
    # Потолок 3500 м: дальше запрос к Overpass становится тяжёлым и начинает
    # отваливаться по таймауту. Обратный путь и так укладываем по факту в бюджет.
    return int(min(3500, max(800, dist_km * 1000)))


def _classify(tags: dict) -> List[str]:
    matched = []
    amenity = tags.get("amenity", "")
    tourism = tags.get("tourism", "")
    leisure = tags.get("leisure", "")
    building = tags.get("building", "")
    if "historic" in tags or tourism == "attraction":
        matched.append("history")
    if tourism in ("gallery", "museum", "artwork"):
        matched.append("art")
    if building in ("cathedral", "church", "temple", "mosque") or tags.get("historic") == "building":
        matched.append("arch")
    if leisure in ("park", "garden", "nature_reserve") or tourism in ("viewpoint", "picnic_site"):
        matched.append("walk")
    if amenity in ("restaurant", "cafe"):
        matched.append("food")
    if tourism in ("viewpoint", "attraction", "artwork"):
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
    if leisure in ("park", "garden", "nature_reserve"):
        return 40, 20
    if tourism in ("viewpoint", "artwork"):
        return 20, 10
    return 30, 15


def _overpass(query: str) -> list:
    """Первое ответившее зеркало Overpass. Кидает исключение, если молчат все."""
    last = None
    for url in OVERPASS_URLS:
        try:
            with httpx.Client(timeout=TIMEOUT, headers=HEADERS) as client:
                r = client.post(url, data={"data": query})
                r.raise_for_status()
                return r.json().get("elements", [])
        except Exception as e:  # noqa: BLE001 — пробуем следующее зеркало
            last = e
            log.warning("overpass %s недоступен: %s", url, e)
    raise last if last else RuntimeError("overpass: нет зеркал")


def fetch_osm_places(start, interests, minutes=120, limit=80) -> List[dict]:
    ids = [i for i in (interests or []) if i in INTERESTS]

    radius_m = _reachable_radius_m(minutes)
    lon, lat = start
    body = "".join(f"{sel}(around:{radius_m},{lat},{lon});" for sel in OSM_SELECTORS)
    query = f"[out:json][timeout:40];({body});out center {limit * 2};"

    elements = _overpass(query)

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


def _kudago_city(start) -> Optional[str]:
    """Ближайший город KudaGo, если он в разумной близости (иначе событий нет)."""
    best, best_d = None, float("inf")
    for slug, center in KUDAGO_CITIES.items():
        d = _haversine_m(start, center)
        if d < best_d:
            best, best_d = slug, d
    return best if best_d < 80000 else None  # 80 км — иначе это другой город


def fetch_kudago_events(start, minutes=120, limit=20) -> List[dict]:
    city = _kudago_city(start)
    if not city:
        return []  # в этом городе KudaGo не работает — не тащим чужие события

    radius_m = _reachable_radius_m(minutes)
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


# Категория Культуры.РФ → наши интересы.
CULTURE_INTEREST = {
    "музе": ["art", "culture"], "выстав": ["art", "culture"], "галере": ["art"],
    "театр": ["culture"], "концерт": ["culture"], "спектакл": ["culture"],
    "экскурс": ["history"], "лекц": ["culture"], "фестивал": ["culture"],
    "кино": ["culture"], "прогул": ["walk"],
}


def _culture_interests(category: str, tags) -> List[str]:
    text = (category or "").lower() + " " + " ".join(tags or []).lower()
    out = []
    for key, ints in CULTURE_INTEREST.items():
        if key in text:
            out.extend(ints)
    return list(dict.fromkeys(out)) or ["culture"]


def fetch_culture_events(start, minutes=120, limit=40) -> List[dict]:
    """События Культуры.РФ (ЕИПСК) рядом. Открыто по всей РФ, есть «Пушкинская карта».

    Схема ответа на разных версиях чуть отличается — берём поля максимально
    терпимо, любой сбой → пустой список (источник необязательный).
    """
    radius_m = _reachable_radius_m(minutes)
    lon, lat = start
    now_ms = int(time.time() * 1000)
    params = {
        "longitude": lon, "latitude": lat, "distance": radius_m,
        "start": now_ms, "limit": limit, "sort": "start", "order": "asc",
    }
    data = None
    for url in CULTURE_URLS:
        try:
            with httpx.Client(timeout=20.0, headers=HEADERS) as client:
                r = client.get(url, params=params)
                if r.status_code != 200:
                    log.warning("culture %s → %s", url, r.status_code)
                    continue
                data = r.json()
                break
        except Exception as e:  # noqa: BLE001
            log.warning("culture %s fail: %s", url, e)
    if not data:
        return []

    items = data.get("events") or data.get("results") or []
    out = []
    for it in items:
        # Координаты события — из его площадки (у события массив places или один place).
        place = None
        if isinstance(it.get("places"), list) and it["places"]:
            place = it["places"][0]
        elif isinstance(it.get("place"), dict):
            place = it["place"]
        if not place:
            continue
        plon = place.get("longitude")
        plat = place.get("latitude")
        loc = place.get("location") or {}
        if (plon is None or plat is None) and isinstance(loc.get("coordinates"), list) and len(loc["coordinates"]) == 2:
            plon, plat = loc["coordinates"][0], loc["coordinates"][1]
        if plon is None or plat is None:
            continue

        cat = (it.get("category") or {})
        cat_name = cat.get("name") if isinstance(cat, dict) else str(cat)
        interests = _culture_interests(cat_name, it.get("tags"))
        name = (it.get("name") or "Событие").strip()
        pushkin = bool(it.get("pushkinCard") or it.get("isPushkinsCard"))
        highlights = ["Пушкинская карта"] if pushkin else ["Событие"]
        is_free = bool(it.get("isFree") or it.get("free"))
        price = str(it.get("price") or "").strip()
        out.append({
            "id": f"culture/{it.get('_id') or it.get('id')}",
            "name": name,
            "short": name,
            "interests": interests,
            "price": "бесплатно" if is_free else (price or "уточняйте"),
            "priceNote": price if not is_free else "",
            "hours": "",
            "blurb": (it.get("description") or place.get("name") or "").strip(),
            "highlights": highlights,
            "coords": [float(plon), float(plat)],
            "idealVisit": 60,
            "minVisit": 30,
        })
    log.info("culture: %s событий", len(out))
    return out


def fetch_places(start, interests, minutes=120) -> List[dict]:
    """Места (OSM) + события (Культура.РФ, KudaGo) в радиусе, доступном за время.

    Радиус растёт со временем. При сбое OSM запасной каталог берём только рядом с
    Казанью — в других городах лучше показать пусто, чем чужие места.
    """
    try:
        places = fetch_osm_places(start, interests, minutes)
    except Exception as e:
        log.warning("overpass упал: %s", e)
        places = list(PLACES) if _haversine_m(start, KAZAN) < 30000 else []

    # События: Культура.РФ (вся РФ) + KudaGo (где есть). Дедуп по (имя, ~координаты).
    events = fetch_culture_events(start, minutes) + fetch_kudago_events(start, minutes)
    seen, uniq = set(), []
    for e in events:
        key = (e["name"].lower(), round(e["coords"][0], 4), round(e["coords"][1], 4))
        if key in seen:
            continue
        seen.add(key)
        uniq.append(e)
    return places + uniq
