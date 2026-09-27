"""Подбор мест по контракту API.md (формула из frontend planner.js)."""

from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import List, Optional, Tuple

from backend.app.data.places import PLACES
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

    for p in PLACES:
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


def _best_chain(
    start: Tuple[float, float],
    places: List[PlaceOut],
    minutes: int,
) -> Optional[ChainOut]:
    """Пара мест с max visitA+visitB, укладывающаяся в budget."""
    candidates = [p for p in places if p.eval.status != "no"]
    if len(candidates) < 2:
        if len(candidates) == 1:
            p = candidates[0]
            total = p.walkTo + p.eval.visit + p.walkBack
            if total <= minutes:
                return ChainOut(
                    total=total,
                    buffer=max(0, minutes - total),
                    walkBack=p.walkBack,
                    legs=[ChainLeg(placeId=p.id, walk=p.walkTo, visit=p.eval.visit)],
                )
        return None

    by_id = {p.id: p for p in candidates}
    best = None
    best_score = -1

    ids = list(by_id.keys())
    for i, id_a in enumerate(ids):
        for id_b in ids[i + 1 :]:
            a, b = by_id[id_a], by_id[id_b]
            ca = (a.coords[0], a.coords[1])
            cb = (b.coords[0], b.coords[1])

            # порядок: сначала ближе к старту
            if a.walkTo <= b.walkTo:
                first, second = a, b
                c1, c2 = ca, cb
            else:
                first, second = b, a
                c1, c2 = cb, ca

            w0 = walk_min(start, c1)
            w1 = walk_min(c1, c2)
            w2 = walk_min(c2, start)
            v1 = first.eval.visit
            v2 = second.eval.visit
            total = w0 + v1 + w1 + v2 + w2
            if total > minutes:
                continue
            score = v1 + v2
            if score > best_score:
                best_score = score
                best = ChainOut(
                    total=total,
                    buffer=minutes - total,
                    walkBack=w2,
                    legs=[
                        ChainLeg(placeId=first.id, walk=w0, visit=v1),
                        ChainLeg(placeId=second.id, walk=w1, visit=v2),
                    ],
                )

    return best
