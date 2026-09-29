"""Подбор мест по контракту API.md (формула из frontend planner.js)."""

from __future__ import annotations

import itertools
import math
from datetime import datetime, timezone
from typing import List, Optional, Sequence, Tuple

from backend.app.data.sources import fetch_places, _region_offset
from backend.app.models.schemas import (
    ChainLeg,
    ChainOut,
    PlaceEval,
    PlaceOut,
    SearchRequest,
    SearchResponse,
)

BUFFER = 10
WALK_SPEED = 4.8  # км/ч
DETOUR = 1.3
MIN_RATING = 4.5  # показываем только качественные места: оценка 4.5+ и с отзывами


def _haversine_km(a: Tuple[float, float], b: Tuple[float, float]) -> float:
    """a, b = (lon, lat)."""
    lon1, lat1 = a
    lon2, lat2 = b
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    x = math.sin(dlat / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlon / 2) ** 2
    return 2 * r * math.asin(math.sqrt(x))


def walk_min(a: Tuple[float, float], b: Tuple[float, float]) -> int:
    """max(3, round(haversine_km × 1.3 / 4.8 × 60))."""
    km = _haversine_km(a, b)
    return max(3, int(round(km * DETOUR / WALK_SPEED * 60)))


def _fmt_dist(meters: float) -> str:
    if meters < 1000:
        return f"{int(round(meters))} м"
    return f"{meters / 1000:.1f} км".replace(".", ",")


def _round5(n: int) -> int:
    return max(5, int(round(n / 5) * 5))


def _filter_interests(place: dict, interests: List[str]) -> bool:
    if not interests:
        return True
    return bool(set(place.get("interests") or []) & set(interests))


def search_places(req: SearchRequest) -> SearchResponse:
    start = (req.start[0], req.start[1])  # lon, lat
    minutes = req.minutes

    evaluated: List[PlaceOut] = []

    # реальные данные: места (OSM) + мероприятия (KudaGo)
    catalog = fetch_places(start, req.interests, minutes)

    for p in catalog:
        if not _filter_interests(p, req.interests):
            continue

        # Только проверенно-хорошие места: оценка 4.5+ и с реальными отзывами.
        # Без отзывов (в т.ч. «★5 при 0 отзывов»), события и OSM без оценки — прячем.
        rating = p.get("rating")
        reviews = p.get("reviewCount") or 0
        if rating is None or reviews <= 0 or rating < MIN_RATING:
            continue

        coords = (p["coords"][0], p["coords"][1])
        walk_to = walk_min(start, coords)
        walk_back = walk_min(coords, start)
        road = walk_to + walk_back
        ideal = int(p["idealVisit"])
        min_v = int(p["minVisit"])

        if minutes >= road + ideal + BUFFER:
            status = "fits"
            visit = ideal
        elif minutes >= road + min_v + BUFFER:
            status = "tight"
            visit = minutes - road - BUFFER
        else:
            status = "no"
            visit = min_v

        visit = _round5(visit)
        total = road + visit
        dist_m = _haversine_km(start, coords) * 1000

        evaluated.append(
            PlaceOut(
                id=p["id"],
                name=p["name"],
                short=p["short"],
                interests=list(p["interests"]),
                price=p["price"],
                priceNote=p["priceNote"],
                hours=p["hours"],
                blurb=p["blurb"],
                highlights=list(p["highlights"]),
                coords=list(p["coords"]),
                walkTo=walk_to,
                walkBack=walk_back,
                distance=_fmt_dist(dist_m),
                rating=p.get("rating"),
                reviewCount=p.get("reviewCount"),
                eval=PlaceEval(
                    status=status,
                    visit=visit,
                    buffer=BUFFER,
                    road=road,
                    total=total,
                ),
            )
        )

    order = {"fits": 0, "tight": 1, "no": 2}
    evaluated.sort(key=lambda x: (order[x.eval.status], x.eval.road))

    fits_n = sum(1 for x in evaluated if x.eval.status == "fits")
    chains = build_chains(start, evaluated, minutes, req.interests)

    return SearchResponse(
        found=len(evaluated),
        fits=fits_n,
        places=evaluated,
        chain=chains[0] if chains else None,
        chains=chains,
        tzOffset=_region_offset(start),  # кэшируется — второго запроса к DaData не будет
    )


CHAIN_MAX = 6  # больше не набираем: визиты дробятся, и точек для роутера станет >10
CHAIN_RETURN_BUFFER = 10  # домой возвращаемся минимум за 10 минут до конца лимита
CHAIN_VARIANTS_MAX = 3    # сколько вариантов цепочки предлагать, если всё не влезло


def _covering_chain(
    start: Tuple[float, float],
    places: List[PlaceOut],
    minutes: int,
    target: Sequence[str],
) -> Optional[ChainOut]:
    """Жадная цепочка, покрывающая ВСЕ интересы из target (по месту на интерес),
    ближайшими качественными местами, с возвратом за 10 минут до конца лимита.
    Если покрыть все интересы в срок не удаётся — None."""
    budget = minutes - CHAIN_RETURN_BUFFER
    needed = set(target)
    pool = [
        p for p in places
        if p.eval.status != "no" and (set(p.interests) & needed)
    ]

    legs: List[ChainLeg] = []
    current = start
    spent = 0
    used: set = set()
    covered: set = set()

    def nearest(only_needed: bool):
        best, best_walk = None, 0
        for p in pool:
            if p.id in used:
                continue
            if only_needed and not (set(p.interests) & (needed - covered)):
                continue
            c = (p.coords[0], p.coords[1])
            w = walk_min(current, c)
            back = walk_min(c, start)
            if spent + w + p.eval.visit + back <= budget:
                if best is None or w < best_walk:
                    best, best_walk = p, w
        return best, best_walk

    # 1) покрываем каждый нужный интерес ближайшим подходящим местом
    while (needed - covered) and len(legs) < CHAIN_MAX:
        best, best_walk = nearest(only_needed=True)
        if best is None:
            break
        legs.append(ChainLeg(placeId=best.id, walk=best_walk, visit=best.eval.visit))
        spent += best_walk + best.eval.visit
        current = (best.coords[0], best.coords[1])
        used.add(best.id)
        covered |= set(best.interests) & needed

    if needed - covered:  # не уложились по времени под все интересы combo
        return None

    # 2) если одно место закрыло несколько интересов — добьём цепочку до 2 точек
    while len(legs) < 2 and len(legs) < CHAIN_MAX:
        best, best_walk = nearest(only_needed=False)
        if best is None:
            break
        legs.append(ChainLeg(placeId=best.id, walk=best_walk, visit=best.eval.visit))
        spent += best_walk + best.eval.visit
        current = (best.coords[0], best.coords[1])
        used.add(best.id)

    if len(legs) < 2:
        return None

    walk_back = walk_min(current, start)
    total = spent + walk_back
    return ChainOut(
        total=total,
        buffer=max(0, minutes - total),
        walkBack=walk_back,
        legs=legs,
        interests=sorted(covered),
    )


def build_chains(
    start: Tuple[float, float],
    places: List[PlaceOut],
    minutes: int,
    interests: Sequence[str],
) -> List[ChainOut]:
    """Строим цепочки под выбранные интересы.

    • Хватает времени на все интересы → одна цепочка со всеми.
    • Не хватает → варианты по подмножествам (убираем по одному интересу):
      напр. еда+культура+прогулка не влезает → предлагаем еда+культура,
      еда+прогулка, культура+прогулка — те, что укладываются.
    """
    reachable = [p for p in places if p.eval.status != "no"]
    if not reachable:
        return []

    # интересы, по которым реально есть места рядом
    available = {i for p in reachable for i in (p.interests or [])}
    target = [i for i in dict.fromkeys(interests or []) if i in available]

    # интересы не заданы (или ни одного совпадения) — обычная жадная цепочка
    if not target:
        chain = _covering_chain(start, reachable, minutes, sorted(available))
        return [chain] if chain else []

    # 1) пробуем покрыть все выбранные интересы
    full = _covering_chain(start, reachable, minutes, target)
    if full:
        return [full]

    # 2) времени на всё не хватило — варианты по подмножествам (по убыванию размера,
    # вплоть до одиночного интереса: лучше предложить цепочку хотя бы по одному).
    for k in range(len(target) - 1, 0, -1):
        variants: List[ChainOut] = []
        seen: set = set()
        for combo in itertools.combinations(target, k):
            ch = _covering_chain(start, reachable, minutes, combo)
            if not ch:
                continue
            key = tuple(sorted(leg.placeId for leg in ch.legs))
            if key in seen:
                continue
            seen.add(key)
            variants.append(ch)
        if variants:
            variants.sort(key=lambda c: (-len(c.legs), c.total))
            return variants[:CHAIN_VARIANTS_MAX]

    return []
