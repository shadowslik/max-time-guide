from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException, Query, Request

from backend.app.core import geocode as geocode_mod
from backend.app.core import routing as routing_mod
from backend.app.core.planner import search_places
from backend.app.core.session import open_session
from backend.app.core.trips import create_trip, list_trips
from backend.app.data.interests import INTERESTS
from backend.app.models.schemas import (
    GeocodeResponse,
    HealthResponse,
    InterestsResponse,
    RouteRequest,
    RouteResponse,
    SearchRequest,
    SearchResponse,
    SessionRequest,
    SessionResponse,
    TripCreate,
    TripOut,
    TripsResponse,
)

router = APIRouter()


def _user_from_auth(authorization: str | None) -> str:
    """Authorization: tma <initData> → userId (мягкий разбор)."""
    if not authorization:
        return "max:anonymous"
    parts = authorization.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "tma":
        return "max:anonymous"
    sess = open_session(parts[1], strict=False)
    return sess.userId if sess else "max:anonymous"


@router.get("/health", response_model=HealthResponse)
def health():
    return HealthResponse(status="ok")


@router.post("/search", response_model=SearchResponse)
def api_search(body: SearchRequest):
    try:
        return search_places(body)
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail={"error": {"code": "invalid_request", "message": str(e)}},
        ) from e


@router.post("/route", response_model=RouteResponse)
async def api_route(body: RouteRequest):
    for pt in body.points:
        if len(pt) < 2:
            raise HTTPException(
                status_code=400,
                detail={"error": {"code": "invalid_coordinates", "message": "Нужны [lon, lat]"}},
            )
        lon, lat = pt[0], pt[1]
        if not (-180 <= lon <= 180 and -90 <= lat <= 90):
            raise HTTPException(
                status_code=400,
                detail={"error": {"code": "invalid_coordinates", "message": "Долгота/широта вне диапазона"}},
            )

    result = await routing_mod.fetch_route(body.points)
    if result is None:
        # фронт ждёт null при сбое — но FastAPI model обязателен:
        # отдаём 502, клиент в API.md при !ok возвращает null
        raise HTTPException(
            status_code=502,
            detail={"error": {"code": "router_unavailable", "message": "Роутер не ответил"}},
        )
    return result


@router.get("/geocode", response_model=GeocodeResponse)
async def api_geocode(
    q: str = Query(..., min_length=1),
    limit: int = Query(6, ge=1, le=10),
):
    if len(q.strip()) < 3:
        return GeocodeResponse(results=[])
    results = await geocode_mod.search_address(q, limit=limit)
    return GeocodeResponse(results=results)


@router.get("/interests", response_model=InterestsResponse)
def api_interests():
    return InterestsResponse(interests=INTERESTS)


@router.get("/trips", response_model=TripsResponse)
def api_trips_list(authorization: str | None = Header(default=None)):
    uid = _user_from_auth(authorization)
    return TripsResponse(trips=list_trips(uid))


@router.post("/trips", response_model=TripOut)
def api_trips_create(
    body: TripCreate,
    authorization: str | None = Header(default=None),
):
    uid = _user_from_auth(authorization)
    return create_trip(uid, body)


@router.post("/session", response_model=SessionResponse)
def api_session(body: SessionRequest):
    sess = open_session(body.initData, strict=False)
    if not sess:
        raise HTTPException(
            status_code=401,
            detail={"error": {"code": "invalid_init", "message": "Невалидный initData"}},
        )
    return sess
