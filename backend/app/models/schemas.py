from __future__ import annotations

from typing import List, Literal, Optional
from pydantic import BaseModel, Field, field_validator


class SearchRequest(BaseModel):
    start: List[float] = Field(..., min_length=2, max_length=2)
    minutes: int = Field(..., ge=15, le=240)
    interests: List[str] = Field(default_factory=list)
    startAt: Optional[str] = None

    @field_validator("start")
    @classmethod
    def coords(cls, v: List[float]) -> List[float]:
        lon, lat = float(v[0]), float(v[1])
        if not (-180 <= lon <= 180 and -90 <= lat <= 90):
            raise ValueError("координаты вне диапазона")
        return [lon, lat]


class PlaceEval(BaseModel):
    status: Literal["fits", "tight", "no"]
    visit: int
    buffer: int
    road: int
    total: int


class PlaceOut(BaseModel):
    id: str
    name: str
    short: str
    interests: List[str]
    price: str
    priceNote: str
    hours: str
    blurb: str
    highlights: List[str]
    coords: List[float]
    walkTo: int
    walkBack: int
    distance: str
    eval: PlaceEval


class ChainLeg(BaseModel):
    placeId: str
    walk: int
    visit: int


class ChainOut(BaseModel):
    total: int
    buffer: int
    walkBack: int
    legs: List[ChainLeg]


class SearchResponse(BaseModel):
    found: int
    fits: int
    places: List[PlaceOut]
    chain: Optional[ChainOut] = None


class RouteRequest(BaseModel):
    points: List[List[float]] = Field(..., min_length=2, max_length=10)


class RouteLeg(BaseModel):
    duration: int
    length: int


class RouteResponse(BaseModel):
    line: List[List[float]]
    legs: List[RouteLeg]


class GeocodeResult(BaseModel):
    id: str
    title: str
    subtitle: str
    coords: List[float]


class GeocodeResponse(BaseModel):
    results: List[GeocodeResult]


class InterestOut(BaseModel):
    id: str
    label: str
    icon: str


class InterestsResponse(BaseModel):
    interests: List[InterestOut]


class TripCreate(BaseModel):
    placeId: Optional[str] = None
    minutes: int
    walkTo: int
    visit: int
    walkBack: int
    interests: List[str] = Field(default_factory=list)
    start: Optional[List[float]] = None


class TripOut(BaseModel):
    id: str
    city: str
    place: str
    placeId: Optional[str]
    date: str
    minutes: int
    walkTo: int
    visit: int
    walkBack: int
    interests: List[str]


class TripsResponse(BaseModel):
    trips: List[TripOut]


class SessionRequest(BaseModel):
    initData: str


class SessionResponse(BaseModel):
    userId: str
    displayName: str
    city: str


class HealthResponse(BaseModel):
    status: str


class ErrorBody(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    error: ErrorBody
