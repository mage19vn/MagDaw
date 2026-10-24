from __future__ import annotations

import json
from concurrent.futures import Future, ThreadPoolExecutor
from copy import deepcopy
from pathlib import Path
from threading import Lock
from typing import Any, Protocol
from uuid import uuid4

import numpy as np
import pretty_midi
import soundfile as sf

from backend.app.audio.compose import compose_midi
from backend.app.audio.effects import MASTER_MAPPING_WARNING, apply_master
from backend.app.audio.render import SAMPLE_RATE, apply_track_mixer, render_track, verify_audio
from backend.app.domain.models import Project, audible_tracks, beat_to_seconds, project_end_beat

OUTPUT_ROOT = Path(__file__).resolve().parents[3] / 'output'
FILE_NAMES = {'midi': 'bai_hat.mid', 'preview': 'bai_hat_preview.wav', 'final': 'bai_hat_final.wav'}
MAX_EXPORT_SECONDS = 20 * 60
MAX_EXPORT_NOTES = 200_000


class ExportService(Protocol):
    def submit(self, project: Project) -> dict[str, Any]: ...
    def get(self, job_id: str) -> dict[str, Any] | None: ...


class LocalExportService:
    """Một worker giới hạn RAM; mỗi job giữ snapshot độc lập và thư mục riêng."""

    def __init__(self, output_root: Path = OUTPUT_ROOT) -> None:
        self.output_root = output_root
        self._jobs: dict[str, dict[str, Any]] = {}
        self._lock = Lock()
        self._executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix='magdaw-export')
        self._futures: dict[str, Future[None]] = {}

    def submit(self, project: Project) -> dict[str, Any]:
        snapshot = Project.model_validate(project.model_dump())
        job_id = str(uuid4())
        job: dict[str, Any] = {
            'id': job_id, 'status': 'queued', 'stage': 'Đang chờ xuất', 'progress': 0,
            'warnings': [MASTER_MAPPING_WARNING], 'error': None, 'files': {},
        }
        with self._lock:
            self._jobs[job_id] = job
        initial = deepcopy(job)
        self._futures[job_id] = self._executor.submit(self._run, job_id, snapshot)
        return initial

    def get(self, job_id: str) -> dict[str, Any] | None:
        with self._lock:
            job = self._jobs.get(job_id)
            return deepcopy(job) if job else None

    def _update(self, job_id: str, **changes: Any) -> None:
        with self._lock:
            self._jobs[job_id].update(changes)

    def _warn(self, job_id: str, warnings: list[str]) -> None:
        with self._lock:
            existing = self._jobs[job_id]['warnings']
            for warning in warnings:
                if warning not in existing:
                    existing.append(warning)

    def _run(self, job_id: str, project: Project) -> None:
        try:
            self._export(job_id, project)
        except Exception as error:
            # Worker giữ lỗi trong job để API và project đang sửa vẫn hoạt động.
            self._update(job_id, status='failed', stage='Xuất thất bại', error=f'Không thể xuất nhạc: {error}')

    def _export(self, job_id: str, project: Project) -> None:
        self._update(job_id, status='running', stage='Kiểm tra snapshot', progress=.05)
        duration = beat_to_seconds(project_end_beat(project), project.bpm) + 2.0
        note_count = sum(len(c.notes) for t in project.tracks for c in t.clips)
        if duration > MAX_EXPORT_SECONDS or note_count > MAX_EXPORT_NOTES:
            raise ValueError('Bản xuất vượt giới hạn 20 phút hoặc 200.000 note của phiên bản cục bộ.')
        tracks = audible_tracks(project)
        all_note_count = sum(len(c.notes) for t in tracks for c in t.clips)
        silent_by_mixer = not tracks
        if not tracks:
            self._warn(job_id, ['Tất cả track bị mute hoặc bị loại theo solo: xuất bản im lặng theo đúng mixer.'])
        elif all_note_count == 0:
            self._warn(job_id, ['Các track nghe được chưa có note: xuất bản im lặng.'])
        directory = self.output_root / job_id
        directory.mkdir(parents=True, exist_ok=False)
        (directory / 'project_snapshot.json').write_text(json.dumps(project.model_dump(), ensure_ascii=False, indent=2), encoding='utf-8')
        self._update(job_id, stage='Tạo MIDI', progress=.12)
        midi = compose_midi(project)
        midi.write(str(directory / FILE_NAMES['midi']))
        samples = int(round(duration * SAMPLE_RATE))
        mix = np.zeros((2, samples), dtype=np.float32)
        for index, track in enumerate(tracks):
            self._update(job_id, stage=f'Render track {index + 1}/{len(tracks)}: {track.name}', progress=.18 + .45 * index / max(1, len(tracks)))
            audio, warnings = render_track(track, project.bpm, samples)
            self._warn(job_id, warnings)
            mix += apply_track_mixer(audio, track.volume_db, track.pan)
        preview_analysis = verify_audio(mix)
        if all_note_count and preview_analysis['peak'] == 0:
            raise ValueError('Renderer không tạo tín hiệu cho các note nghe được. Nếu chỉ có drum, hãy cài FluidSynth và SoundFont để render trống.')
        if preview_analysis['peak'] > 1:
            self._warn(job_id, ['Preview có peak trên 0 dBFS; WAV float giữ tín hiệu nhưng khi nghe có thể bị clip. Hãy giảm mixer hoặc gain.'])
        self._update(job_id, stage='Áp dụng master', progress=.72)
        final = apply_master(mix, project.master)
        final_analysis = verify_audio(final)
        if final_analysis['peak'] > 1:
            self._warn(job_id, ['Final có peak trên 0 dBFS; hãy giảm gain hoặc bật limiter trước khi giao bản nhạc.'])
        self._update(job_id, stage='Ghi và kiểm tra file', progress=.88)
        for kind, audio in [('preview', mix), ('final', final)]:
            path = directory / FILE_NAMES[kind]
            sf.write(str(path), audio.T, SAMPLE_RATE, subtype='FLOAT')
            recorded, rate = sf.read(str(path), dtype='float32', always_2d=True)
            if rate != SAMPLE_RATE or recorded.shape != (samples, 2) or not np.isfinite(recorded).all():
                raise ValueError(f'File {path.name} không qua được kiểm tra sau khi ghi.')
        decoded = pretty_midi.PrettyMIDI(str(directory / FILE_NAMES['midi']))
        if sum(len(i.notes) for i in decoded.instruments) != all_note_count:
            raise ValueError('MIDI đọc lại không khớp số note của snapshot.')
        analysis = {'preview': preview_analysis, 'final': final_analysis, 'silent_by_mixer': silent_by_mixer}
        (directory / 'export_report.json').write_text(json.dumps(analysis, ensure_ascii=False, indent=2), encoding='utf-8')
        self._update(job_id, status='completed', stage='Đã xuất và kiểm tra file', progress=1,
                     files={kind: f'/api/exports/{job_id}/files/{name}' for kind, name in FILE_NAMES.items()}, analysis=analysis)

    def close(self) -> None:
        self._executor.shutdown(wait=False, cancel_futures=True)
