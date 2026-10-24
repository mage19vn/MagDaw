from __future__ import annotations

from contextlib import asynccontextmanager
from copy import deepcopy
from pathlib import Path
from typing import Any

from fastapi import Body, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import ValidationError

from backend.app.domain.models import Project
from backend.app.services.export_service import FILE_NAMES, LocalExportService
from backend.app.song_data import SAMPLE_PROJECT

exports = LocalExportService()


@asynccontextmanager
async def lifespan(application: FastAPI):
    yield
    exports.close()


app = FastAPI(title='MagDaw — DAW cục bộ', lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:8000', 'http://127.0.0.1:8000'], allow_methods=['GET', 'POST'], allow_headers=['Content-Type'])


@app.exception_handler(RequestValidationError)
async def request_error(request: Request, error: RequestValidationError) -> JSONResponse:
    return JSONResponse(status_code=422, content={'detail': 'Dữ liệu yêu cầu không hợp lệ. Hãy gửi một project JSON đầy đủ.'})


@app.get('/api/health')
def health() -> dict[str, str]:
    return {'status': 'ok'}


@app.get('/api/sample')
def sample() -> dict[str, Any]:
    return deepcopy(SAMPLE_PROJECT)


@app.post('/api/exports', status_code=202)
def create_export(payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    try:
        project = Project.model_validate(payload)
    except (ValidationError, ValueError) as error:
        if isinstance(error, ValidationError):
            custom = [str(item.get('ctx', {}).get('error', '')) for item in error.errors() if item.get('ctx', {}).get('error')]
            fields = ', '.join('.'.join(str(part) for part in item['loc']) or 'project' for item in error.errors())
            message = ' '.join(custom) or f'Kiểm tra giá trị và miền cho phép tại: {fields}.'
        else:
            message = str(error)
        raise HTTPException(status_code=422, detail=f'Project không hợp lệ. {message}') from error
    return exports.submit(project)


@app.get('/api/exports/{job_id}')
def export_status(job_id: str) -> dict[str, Any]:
    job = exports.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail='Không tìm thấy công việc xuất nhạc; công việc được lưu trong phiên chạy backend hiện tại.')
    return job


@app.get('/api/exports/{job_id}/files/{filename}')
def export_file(job_id: str, filename: str) -> FileResponse:
    job = exports.get(job_id)
    if not job or job['status'] != 'completed' or filename not in FILE_NAMES.values():
        raise HTTPException(status_code=404, detail='File chưa sẵn sàng hoặc không tồn tại.')
    path = exports.output_root / job_id / filename
    if not path.is_file():
        raise HTTPException(status_code=404, detail='File kết quả không còn trên ổ đĩa.')
    return FileResponse(path, media_type='audio/midi' if filename.endswith('.mid') else 'audio/wav', filename=filename)


FRONTEND_DIST = Path(__file__).resolve().parents[2] / 'frontend' / 'dist'
if FRONTEND_DIST.is_dir():
    app.mount('/', StaticFiles(directory=FRONTEND_DIST, html=True), name='frontend')
