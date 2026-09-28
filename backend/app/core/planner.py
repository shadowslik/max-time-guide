"""Подбор мест по контракту API.md (формула из frontend planner.js)."""

from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import List, Optional, Tuple

from backend.app.data.sources import fetch_places
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
    chain = _best_chain(start, evaluated, minutes)

    return SearchResponse(
        found=len(evaluated),
        fits=fits_n,
        places=evaluated,
        chain=chain,
    )


CHAIN_MAX = 6  # больше не набираем: визиты дробятся, и точек для роутера станет >10
CHAIN_RETURN_BUFFER = 10  # домой возвращаемся минимум за 10 минут до конца лимита
CHAIN_MIN_RATING = 4.0    # в цепочку — только хорошие места (или без оценки: судить нельзя)


def _best_chain(
    start: Tuple[float, float],
    places: List[PlaceOut],
    minutes: int,
) -> Optional[ChainOut]:
    """Жадная цепочка из ближайших мест с высокой оценкой. Набираем столько,
    чтобы вернуться домой не позже, чем за 10 минут до конца лимита времени."""
    budget = minutes - CHAIN_RETURN_BUFFER  # к этому времени должны быть дома
    remaining = [
        p for p in places
        if p.eval.status != "no" and (p.rating is None or p.rating >= CHAIN_MIN_RATING)
    ]
    if not remaining:
        return None

    legs: List[ChainLeg] = []
    current = start
    spent = 0  # уже потраченные дорога + визиты

    while remaining and len(legs) < CHAIN_MAX:
        best = None
        best_walk = 0
        for p in remaining:
            coords = (p.coords[0], p.coords[1])
            w = walk_min(current, coords)
            back = walk_min(coords, start)
            # дойти, постоять и вернуться домой, оставив запас в 10 минут
            if spent + w + p.eval.visit + back <= budget:
                if best is None or w < best_walk:
                    best, best_walk = p, w
        if best is None:
            break
        legs.append(ChainLeg(placeId=best.id, walk=best_walk, visit=best.eval.visit))
        spent += best_walk + best.eval.visit
        current = (best.coords[0], best.coords[1])
        remaining.remove(best)

    if len(legs) < 2:  # цепочка имеет смысл от двух мест
        return None

    walk_back = walk_min(current, start)
    total = spent + walk_back
    return ChainOut(
        total=total,
        buffer=max(0, minutes - total),
        walkBack=walk_back,
        legs=legs,
    )
