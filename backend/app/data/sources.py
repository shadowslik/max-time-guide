"""Реальные данные для подбора: места из OpenStreetMap (Overpass) + мероприятия
из KudaGo. Оба источника открытые и бесплатные, без ключей.

Возвращаем словари той же формы, что раньше лежала в data/places.py, чтобы
planner.search_places работал без изменений. priceNote/hours/blurb — всегда
строки (по схеме PlaceOut они обязательны).
"""

from __future__ import annotations

import logging
import math
import threading
import time
from datetime import datetime, timedelta
from typing import List, Optional

import httpx

from backend.app.config import CULTURE_API_KEY, DADATA_TOKEN, TWOGIS_KEY
from backend.app.data.places import PLACES  # запасной каталог — только рядом с Казанью

log = logging.getLogger(__name__)

# Кэш результатов подбора: Overpass медленный и нестабильный, поэтому удачный
# ответ держим 30 минут — повторные запросы из того же места мгновенны и надёжны.
_CACHE: dict = {}
_CACHE_TTL = 1800.0
_CACHE_LOCK = threading.Lock()


def _cache_get(key):
    with _CACHE_LOCK:
        item = _CACHE.get(key)
    if item and time.time() - item[0] < _CACHE_TTL:
        return item[1]
    return None


def _cache_put(key, value):
    with _CACHE_LOCK:
        _CACHE[key] = (time.time(), value)


# Зеркала Overpass: если одно недоступно/лимитит — идём к следующему. mail.ru
# первым: он в РФ и с нашего сервера отвечает стабильнее зарубежных.
OVERPASS_URLS = [
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]
OVERPASS_TRIES = 2  # инфраструктура Overpass перегружена — пробуем список дважды
KUDAGO_URL = "https://kudago.com/public-api/v1.4/events/"
TWOGIS_URL = "https://catalog.api.2gis.com/3.0/items"
# Культура.РФ / PRO — события по всей России. Публичный доступ закрыт, нужен ключ.
CULTURE_URL = "https://pro.culture.ru/api/2.2/events"

# интерес → поисковые запросы 2ГИС (рубрики). Один запрос на фразу.
TWOGIS_QUERIES = {
    "history": ["достопримечательность", "памятник"],
    "art": ["музей", "галерея"],
    "arch": ["храм", "собор"],
    "walk": ["парк", "сквер"],
    "food": ["кафе", "ресторан"],
    "photo": ["смотровая площадка", "достопримечательность"],
    "culture": ["театр", "музей"],
}
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
    for _ in range(OVERPASS_TRIES):
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


def _visit_time_by_interests(ints) -> tuple:
    s = set(ints)
    if "food" in s:
        return 60, 40
    if {"art", "culture"} & s:
        return 60, 30
    if "walk" in s:
        return 40, 20
    if "photo" in s:
        return 20, 10
    return 30, 15


_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def _hm(s: str) -> Optional[int]:
    """'08:00' → минуты от полуночи. '24:00' → 1440."""
    try:
        h, m = s.split(":")
        return int(h) * 60 + int(m)
    except (ValueError, AttributeError):
        return None


DADATA_GEOLOCATE_URL = "https://suggestions.dadata.ru/suggestions/api/4_1/rs/geolocate/address"

# Часовой пояс определяется РЕГИОНОМ, а не долготой (Казань RU-TA +3, но западнее
# Саратов RU-SAR +4). Смещение UTC по коду субъекта РФ (ISO 3166-2). Без перехода
# на летнее время. Регионы с несколькими зонами — берём столичное смещение.
_RU_TZ_BY_ISO = {}
for _off, _codes in {
    2: ["RU-KGD"],
    3: ["RU-MOW", "RU-MOS", "RU-SPE", "RU-LEN", "RU-AD", "RU-BEL", "RU-BRY", "RU-VLA",
        "RU-VGG", "RU-VLG", "RU-VOR", "RU-IVA", "RU-TVE", "RU-KLU", "RU-KOS", "RU-KDA",
        "RU-KRS", "RU-LIP", "RU-ORL", "RU-PNZ", "RU-PSK", "RU-ROS", "RU-RYA", "RU-SMO",
        "RU-TAM", "RU-TUL", "RU-YAR", "RU-NGR", "RU-MUR", "RU-ARK", "RU-NEN", "RU-KL",
        "RU-KB", "RU-KC", "RU-SE", "RU-IN", "RU-CE", "RU-DA", "RU-STA", "RU-KR", "RU-KO",
        "RU-ME", "RU-MO", "RU-CU", "RU-TA", "RU-NIZ", "RU-KIR", "RU-CR", "RU-SEV"],
    4: ["RU-SAM", "RU-SAR", "RU-UD", "RU-AST", "RU-ULY"],
    5: ["RU-SVE", "RU-PER", "RU-BA", "RU-CHE", "RU-KGN", "RU-ORE", "RU-KHM", "RU-YAN", "RU-TYU"],
    6: ["RU-OMS"],
    7: ["RU-NVS", "RU-TOM", "RU-KEM", "RU-ALT", "RU-AL", "RU-KYA", "RU-KK", "RU-TY"],
    8: ["RU-IRK", "RU-BU"],
    9: ["RU-ZAB", "RU-AMU", "RU-SA"],
    10: ["RU-PRI", "RU-KHA", "RU-YEV"],
    11: ["RU-MAG", "RU-SAK"],
    12: ["RU-KAM", "RU-CHU"],
}.items():
    for _c in _codes:
        _RU_TZ_BY_ISO[_c] = _off

_tz_cache: dict = {}


def _region_offset(start) -> int:
    """Смещение UTC (часы) по региону точки старта. По умолчанию +3 (МСК)."""
    key = (round(start[0], 1), round(start[1], 1))  # ~региональная сетка
    if key in _tz_cache:
        return _tz_cache[key]

    offset = 3
    if DADATA_TOKEN:
        try:
            headers = {
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Authorization": f"Token {DADATA_TOKEN}",
            }
            body = {"lat": start[1], "lon": start[0], "count": 1}
            with httpx.Client(timeout=8.0) as client:
                r = client.post(DADATA_GEOLOCATE_URL, headers=headers, json=body)
                if r.status_code == 200:
                    sug = r.json().get("suggestions") or []
                    if sug:
                        iso = (sug[0].get("data") or {}).get("region_iso_code")
                        offset = _RU_TZ_BY_ISO.get(iso, 3)
        except Exception as e:  # noqa: BLE001
            log.warning("tz lookup fail: %s", e)

    _tz_cache[key] = offset
    return offset


def _now_local(offset: int = 3) -> datetime:
    # Контейнер обычно в UTC; прибавляем смещение региона старта.
    return datetime.utcnow() + timedelta(hours=offset)


def _is_open(schedule: dict, when: datetime) -> Optional[bool]:
    """Открыто ли место в момент when. None — расписания нет / не разобрать
    (тогда место не прячем: у парков и памятников часов обычно нет)."""
    if not isinstance(schedule, dict) or not schedule:
        return None
    if schedule.get("is_24x7") or schedule.get("24x7"):
        return True

    now = when.hour * 60 + when.minute
    today = _DAYS[when.weekday()]
    yday = _DAYS[(when.weekday() - 1) % 7]

    def intervals(day_key):
        day = schedule.get(day_key)
        if not isinstance(day, dict):
            return []
        return day.get("working_hours") or []

    checked = False
    for iv in intervals(today):
        a, b = _hm(iv.get("from")), _hm(iv.get("to"))
        if a is None or b is None:
            continue
        checked = True
        if b > a:  # обычный интервал в пределах суток
            if a <= now < b:
                return True
        else:  # переваливает за полночь (напр. 12:00–02:00)
            if now >= a:
                return True
    # интервал вчерашнего дня, заходящий за полночь в сегодня
    for iv in intervals(yday):
        a, b = _hm(iv.get("from")), _hm(iv.get("to"))
        if a is None or b is None:
            continue
        checked = True
        if b <= a and now < b:  # вчера 12:00–02:00 → сегодня 00:00–02:00
            return True

    return False if checked else None


def _today_hours(schedule: dict, when: datetime) -> str:
    """Строка часов на сегодня для карточки, напр. '08:00–21:00'."""
    if not isinstance(schedule, dict):
        return ""
    day = schedule.get(_DAYS[when.weekday()])
    if not isinstance(day, dict):
        return ""
    parts = []
    for iv in day.get("working_hours") or []:
        f, t = iv.get("from"), iv.get("to")
        if f and t:
            parts.append(f"{f}–{t}")
    return ", ".join(parts)


def fetch_2gis_places(start, interests, minutes=120, per_query=10, limit=80) -> Optional[List[dict]]:
    """Места из 2ГИС по категориям и радиусу (основной источник). None — ключ не задан.

    Закрытые сейчас места не показываем; у кого расписания нет (парки/памятники) —
    оставляем.
    """
    if not TWOGIS_KEY:
        return None
    now = _now_local(_region_offset(start))  # местное время региона точки старта

    ids = [i for i in (interests or []) if i in TWOGIS_QUERIES] or list(TWOGIS_QUERIES)
    # Запрос → интересы, которые его породили (музей относится к art и culture).
    qmap: dict = {}
    for i in ids:
        for q in TWOGIS_QUERIES[i]:
            qmap.setdefault(q, set()).add(i)

    radius_m = _reachable_radius_m(minutes)
    lon, lat = start
    point = f"{lon},{lat}"
    out: List[dict] = []
    by_id: dict = {}

    with httpx.Client(timeout=8.0, headers=HEADERS) as client:
        for q, q_ints in qmap.items():
            params = {
                "q": q, "point": point, "radius": radius_m,
                "sort": "distance", "sort_point": point,
                "page_size": min(per_query, 10),  # 2ГИС: допустимо 1..10
                # branch — организации (музеи/кафе/театры), attraction — парки/памятники/смотровые
                "type": "branch,attraction",
                "fields": "items.point,items.address_name,items.full_name,items.rubrics,items.reviews,items.schedule",
                "key": TWOGIS_KEY,
            }
            try:
                r = client.get(TWOGIS_URL, params=params)
                if r.status_code != 200:
                    log.warning("2gis %s → %s", q, r.status_code)
                    continue
                items = ((r.json() or {}).get("result") or {}).get("items") or []
            except Exception as e:  # noqa: BLE001
                log.warning("2gis %s fail: %s", q, e)
                continue

            for it in items:
                pt = it.get("point") or {}
                plat, plon = pt.get("lat"), pt.get("lon")
                name = (it.get("name") or "").strip()
                if plat is None or plon is None or not name:
                    continue
                oid = str(it.get("id") or f"{name}:{plon}:{plat}")
                if oid in by_id:  # уже нашли по другому запросу — доклеиваем интересы
                    rec = by_id[oid]
                    rec["interests"] = list(dict.fromkeys(rec["interests"] + list(q_ints)))
                    continue
                # Закрытые сейчас места не показываем (у кого расписания нет — оставляем).
                schedule = it.get("schedule")
                if _is_open(schedule, now) is False:
                    continue
                ideal, mn = _visit_time_by_interests(q_ints)
                rubric = next((rb.get("name") for rb in (it.get("rubrics") or []) if rb.get("name")), "")
                reviews = it.get("reviews") or {}
                rec = {
                    "id": f"2gis/{oid}",
                    "name": name,
                    "short": name,
                    "interests": list(q_ints),
                    "price": "уточняйте",
                    "priceNote": "",
                    "hours": _today_hours(schedule, now),
                    "blurb": it.get("full_name") or it.get("address_name") or "",
                    "highlights": [rubric] if rubric else [],
                    "coords": [float(plon), float(plat)],
                    "idealVisit": ideal,
                    "minVisit": mn,
                    "rating": reviews.get("general_rating"),
                    "reviewCount": reviews.get("general_review_count"),
                }
                by_id[oid] = rec
                out.append(rec)
                if len(out) >= limit:
                    log.info("2gis: %s мест", len(out))
                    return out
    log.info("2gis: %s мест", len(out))
    return out


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
    """События Культуры.РФ (PRO) рядом. По всей РФ, есть «Пушкинская карта».

    Требует ключ CULTURE_API_KEY (публичный доступ закрыт). Схема полей берётся
    терпимо, любой сбой → пустой список (источник необязательный).
    """
    if not CULTURE_API_KEY:
        return []  # без ключа PRO.Культура.РФ отдаёт 403 — не ходим зря

    radius_m = _reachable_radius_m(minutes)
    lon, lat = start
    now_ms = int(time.time() * 1000)
    params = {
        "longitude": lon, "latitude": lat, "distance": radius_m,
        "start": now_ms, "limit": limit, "sort": "start", "order": "asc",
    }
    # Ключ шлём и заголовком, и параметром — точную схему подтвердим по логам.
    headers = {**HEADERS, "X-API-KEY": CULTURE_API_KEY}
    data = None
    try:
        with httpx.Client(timeout=20.0, headers=headers, follow_redirects=True) as client:
            r = client.get(CULTURE_URL, params={**params, "apikey": CULTURE_API_KEY})
            if r.status_code != 200:
                log.warning("culture → %s (итог %s)", r.status_code, r.url)
            else:
                data = r.json()
    except Exception as e:  # noqa: BLE001
        log.warning("culture fail: %s", e)
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
    """Места (2ГИС → OSM) + события (Культура.РФ, KudaGo) в доступном за время радиусе.

    Основной источник мест — 2ГИС (быстрый, по всей РФ). Если ключа нет или он
    ничего не вернул — откатываемся на OSM. При сбое OSM запасной каталог берём
    только рядом с Казанью, иначе лучше пусто, чем чужие места.
    """
    # Ключ кэша: место (~100 м), корзина времени (радиус) и набор интересов.
    key = (
        round(start[0], 3), round(start[1], 3),
        _reachable_radius_m(minutes),
        tuple(sorted(interests or [])),
    )
    cached = _cache_get(key)
    if cached is not None:
        return cached

    if TWOGIS_KEY:
        # 2ГИС основной и надёжный — в медленный/нестабильный OSM не лезем вовсе,
        # иначе при пустом ответе 2ГИС запрос завис бы на ретраях Overpass.
        try:
            places = fetch_2gis_places(start, interests, minutes) or []
        except Exception as e:  # noqa: BLE001
            log.warning("2gis упал: %s", e)
            places = []
    else:
        # Ключа 2ГИС нет — работаем на OSM, запасной каталог только рядом с Казанью.
        try:
            places = fetch_osm_places(start, interests, minutes)
        except Exception as e:
            log.warning("overpass упал: %s", e)
            places = list(PLACES) if _haversine_m(start, KAZAN) < 30000 else []

    # События: Культура.РФ (вся РФ) + KudaGo (где есть). Дедуп по (имя, ~координаты).
    events = fetch_culture_events(start, minutes) + fetch_kudago_events(start, minutes)
    seen, uniq = set(), []
    for e in events:
        ekey = (e["name"].lower(), round(e["coords"][0], 4), round(e["coords"][1], 4))
        if ekey in seen:
            continue
        seen.add(ekey)
        uniq.append(e)

    result = places + uniq
    if result:  # пустое не кэшируем — чтобы следующий запрос попробовал снова
        _cache_put(key, result)
    return result
