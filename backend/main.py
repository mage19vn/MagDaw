"""FastAPI entry point. Only wires routes together; logic lives in services.

When the frontend production build exists (frontend/dist), it is served from
the same origin so the app works behind a single public URL: API routes are
registered first, so /api/* always wins over static files.
"""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from export_service import ALLOWED_DOWNLOADS, OUTPUT_DIR, export_project
from models import Project
from project_service import create_project, serialize_project, validate_project

app = FastAPI(title="DAW Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(ValueError)
async def value_error_handler(_request: Request, exc: ValueError) -> JSONResponse:
    return JSONResponse(status_code=400, content={"detail": str(exc)})


@app.get("/api/sample")
def get_sample() -> dict:
    return serialize_project(create_project())


@app.post("/api/validate")
def validate(data: dict) -> dict:
    _project, errors = validate_project(data)
    return {"valid": not errors, "errors": errors}


@app.post("/api/export")
def export(project: Project) -> dict:
    try:
        return export_project(project)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/download/{name}")
def download(name: str) -> FileResponse:
    if name not in ALLOWED_DOWNLOADS:
        raise HTTPException(status_code=404, detail="File khong ton tai.")
    path = OUTPUT_DIR / name
    if not path.is_file():
        raise HTTPException(
            status_code=404,
            detail="File chua duoc tao. Hay chay export truoc.",
        )
    media_type = "audio/midi" if name.endswith(".mid") else "audio/wav"
    return FileResponse(path, media_type=media_type, filename=name)


DIST_DIR = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if DIST_DIR.is_dir():
    app.mount("/", StaticFiles(directory=DIST_DIR, html=True), name="frontend")


def run() -> None:
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)


if __name__ == "__main__":
    run()
