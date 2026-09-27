"""История поездок — in-memory MVP (без БД)."""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Dict, List, Optional
from uuid import uuid4

from backend.app.data.places import CITY_NAME, PLACES
from backend.app.models.schemas import TripCreate, TripOut

# userId -> list of trips
_STORE: Dict[str, List[TripOut]] = {}


def _place_name(place_id: Optional[str]) -> str:
    if not place_id:
        return "Маршрут"
    for p in PLACES:
        if p["id"] == place_id:
            return p["name"]
    return place_id


def list_trips(user_id: str) -> List[TripOut]:
    items = list(_STORE.get(user_id, []))
    items.sort(key=lambda t: t.date, reverse=True)
    return items


def create_trip(user_id: str, body: TripCreate) -> TripOut:
    today = date.today().isoformat()
    existing = _STORE.setdefault(user_id, [])

    # дедуп: тот же placeId в тот же день
    if body.placeId:
        for t in existing:
            if t.placeId == body.placeId and t.date == today:
                return t

    trip = TripOut(
        id=f"trip-{body.placeId or 'x'}-{today}-{uuid4().hex[:6]}",
        city=CITY_NAME,
        place=_place_name(body.placeId),
        placeId=body.placeId,
        date=today,
        minutes=body.minutes,
        walkTo=body.walkTo,
        visit=body.visit,
        walkBack=body.walkBack,
        interests=list(body.interests),
    )
    existing.insert(0, trip)
    return trip
