"""
FastAPI — контракт mini-app «Рядом» (API.md).

uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000
"""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from backend.app.api.routes import router

app = FastAPI(title="Рядом API", version="0.1")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")


@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    msg = "; ".join(
        f"{'.'.join(str(x) for x in e.get('loc', []))}: {e.get('msg')}"
        for e in exc.errors()
    )
    return JSONResponse(
        status_code=400,
        content={"error": {"code": "validation_error", "message": msg}},
    )


@app.get("/health")
def root_health():
    return {"status": "ok"}
