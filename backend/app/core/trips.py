"""История просмотренных маршрутов и статистика профиля — в SQLite."""

from __future__ import annotations

import json
from collections import Counter
from datetime import date, datetime, timezone
from typing import List, Optional
from uuid import uuid4

from backend.app.core import db
from backend.app.data.places import CITY_NAME, PLACES
from backend.app.models.schemas import ProfileStats, TripCreate, TripOut


def _place_name(place_id: Optional[str]) -> str:
    if not place_id:
        return "Маршрут"
    for p in PLACES:
        if p["id"] == place_id:
            return p["name"]
    return place_id


def _row_to_trip(r) -> TripOut:
    try:
        interests = json.loads(r["interests"] or "[]")
    except (json.JSONDecodeError, TypeError):
        interests = []
    return TripOut(
        id=r["id"],
        city=r["city"] or CITY_NAME,
        place=r["place"] or "Маршрут",
        placeId=r["place_id"],
        date=r["date"],
        minutes=r["minutes"] or 0,
        walkTo=r["walk_to"] or 0,
        visit=r["visit"] or 0,
        walkBack=r["walk_back"] or 0,
        interests=interests,
    )


def list_trips(user_id: str, limit: int = 50) -> List[TripOut]:
    rows = db.query(
        "SELECT * FROM trips WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
        (user_id, limit),
    )
    return [_row_to_trip(r) for r in rows]


def create_trip(user_id: str, body: TripCreate, place_name: Optional[str] = None) -> TripOut:
    today = date.today().isoformat()

    # дедуп: тот же placeId в тот же день у этого пользователя
    if body.placeId:
        same = db.query(
            "SELECT * FROM trips WHERE user_id = ? AND place_id = ? AND date = ? LIMIT 1",
            (user_id, body.placeId, today),
        )
        if same:
            return _row_to_trip(same[0])

    trip = TripOut(
        id=f"trip-{body.placeId or 'x'}-{today}-{uuid4().hex[:6]}",
        city=CITY_NAME,
        place=place_name or _place_name(body.placeId),
        placeId=body.placeId,
        date=today,
        minutes=body.minutes,
        walkTo=body.walkTo,
        visit=body.visit,
        walkBack=body.walkBack,
        interests=list(body.interests),
    )
    db.execute(
        """
        INSERT INTO trips (id, user_id, place, place_id, city, date, minutes, walk_to,
                           visit, walk_back, interests, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            trip.id, user_id, trip.place, trip.placeId, trip.city, trip.date, trip.minutes,
            trip.walkTo, trip.visit, trip.walkBack, json.dumps(trip.interests, ensure_ascii=False),
            datetime.now(timezone.utc).isoformat(),
        ),
    )
    return trip


def profile_stats(user_id: str) -> ProfileStats:
    trips = list_trips(user_id, limit=1000)
    routes = len(trips)
    minutes = sum(t.minutes for t in trips)
    places = len({t.placeId for t in trips if t.placeId})
    counter: Counter = Counter(i for t in trips for i in (t.interests or []))
    top = counter.most_common(1)
    top_interest = top[0][0] if top else None
    return ProfileStats(
        routes=routes,
        minutes=minutes,
        places=places,
        topInterest=top_interest,
    )
