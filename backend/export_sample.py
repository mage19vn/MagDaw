"""Xuất bài mẫu qua cùng service với API, không cần trình duyệt."""
import json
import time

from backend.app.domain.models import Project
from backend.app.services.export_service import LocalExportService
from backend.app.song_data import SAMPLE_PROJECT


def main() -> None:
    service = LocalExportService()
    job = service.submit(Project.model_validate(SAMPLE_PROJECT))
    try:
        while job['status'] in ('queued', 'running'):
            time.sleep(.1)
            job = service.get(job['id'])
        print(json.dumps(job, ensure_ascii=False, indent=2))
        if job['status'] != 'completed':
            raise SystemExit(1)
    finally:
        service.close()


if __name__ == '__main__':
    main()
