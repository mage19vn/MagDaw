import json
import time
from copy import deepcopy
from pathlib import Path
from threading import Event

import numpy as np
import pretty_midi
import pytest
import soundfile as sf
from fastapi.testclient import TestClient
from pydantic import ValidationError

from backend.app import main
from backend.app.domain.models import Project, audible_tracks, beat_to_seconds
from backend.app.services import export_service
from backend.app.services.export_service import LocalExportService
from backend.app.song_data import SAMPLE_PROJECT


def small_project() -> Project:
    sample = deepcopy(SAMPLE_PROJECT)
    sample['tracks'] = sample['tracks'][:1]
    sample['tracks'][0]['clips'] = sample['tracks'][0]['clips'][:1]
    return Project.model_validate(sample)


def wait_for_job(service: LocalExportService, job_id: str) -> dict:
    deadline = time.monotonic() + 20
    while time.monotonic() < deadline:
        result = service.get(job_id)
        if result['status'] in ('completed', 'failed'):
            return result
        time.sleep(.01)
    pytest.fail('Công việc xuất không kết thúc trong 20 giây.')


def test_validation_round_trip_and_migration():
    project = Project.model_validate(SAMPLE_PROJECT)
    assert Project.model_validate_json(project.model_dump_json()).model_dump() == project.model_dump()
    assert beat_to_seconds(64, project.bpm) == pytest.approx(38.4)
    legacy = deepcopy(SAMPLE_PROJECT)
    legacy['schema_version'] = 0
    del legacy['master']; del legacy['loop']; del legacy['tracks'][0]['instrument_config']
    assert Project.model_validate(legacy).schema_version == 1
    for update in [{'schema_version': 99}, {'bpm': float('nan')}, {'bpm': 0}, {'time_signature': [4, 3]}]:
        with pytest.raises((ValidationError, ValueError)):
            Project.model_validate({**SAMPLE_PROJECT, **update})
    invalid = deepcopy(SAMPLE_PROJECT)
    invalid['tracks'][1]['id'] = invalid['tracks'][0]['id']
    with pytest.raises(ValidationError): Project.model_validate(invalid)
    invalid = deepcopy(SAMPLE_PROJECT)
    invalid['tracks'][0]['clips'][0]['notes'][0]['length_beat'] = 10
    with pytest.raises(ValidationError): Project.model_validate(invalid)


def test_mute_wins_solo():
    project = Project.model_validate(SAMPLE_PROJECT)
    project.tracks[0].solo = True
    assert [t.id for t in audible_tracks(project)] == ['track-0']
    project.tracks[0].mute = True
    assert audible_tracks(project) == []


def test_export_snapshot_and_files(tmp_path, monkeypatch):
    entered = Event()
    release = Event()
    original = export_service.render_track
    def delayed_render(*args):
        entered.set()
        assert release.wait(timeout=10)
        return original(*args)
    monkeypatch.setattr(export_service, 'render_track', delayed_render)
    service = LocalExportService(tmp_path)
    project = small_project()
    expected_pitch = project.tracks[0].clips[0].notes[0].pitch
    job = service.submit(project)
    assert entered.wait(timeout=5)
    project.tracks[0].clips[0].notes[0].pitch = 1
    release.set()
    result = wait_for_job(service, job['id'])
    assert result['status'] == 'completed', result
    folder = tmp_path / job['id']
    midi = pretty_midi.PrettyMIDI(str(folder / 'bai_hat.mid'))
    assert expected_pitch in [n.pitch for n in midi.instruments[0].notes]
    snapshot = json.loads((folder / 'project_snapshot.json').read_text())
    assert snapshot['tracks'][0]['clips'][0]['notes'][0]['pitch'] == expected_pitch
    for filename in ['bai_hat_preview.wav', 'bai_hat_final.wav']:
        audio, rate = sf.read(folder / filename, always_2d=True)
        assert rate == 44100 and audio.shape[1] == 2
        assert audio.shape[0] / rate == pytest.approx(4.4, abs=.01)
        assert np.isfinite(audio).all() and np.max(np.abs(audio)) > 0
    service.close()


def test_export_failure_retained(tmp_path, monkeypatch):
    def broken(*args): raise RuntimeError('Lỗi render kiểm thử')
    monkeypatch.setattr(export_service, 'render_track', broken)
    service = LocalExportService(tmp_path)
    result = wait_for_job(service, service.submit(small_project())['id'])
    assert result['status'] == 'failed'
    assert 'Lỗi render kiểm thử' in result['error']
    assert result['files'] == {}
    service.close()


def test_export_mute_all_distinct_from_renderer_failure(tmp_path):
    service = LocalExportService(tmp_path)
    project = small_project()
    project.tracks[0].mute = True
    result = wait_for_job(service, service.submit(project)['id'])
    assert result['status'] == 'completed', result
    assert result['analysis']['silent_by_mixer'] is True
    assert result['analysis']['final']['peak'] == 0
    assert any('im lặng' in warning for warning in result['warnings'])
    service.close()


def test_api_validation_job_and_download(tmp_path, monkeypatch):
    service = LocalExportService(tmp_path)
    monkeypatch.setattr(main, 'exports', service)
    with TestClient(main.app) as client:
        assert client.get('/api/health').json() == {'status': 'ok'}
        assert client.get('/api/sample').json()['bpm'] == 100
        assert client.post('/api/exports', json={'schema_version': 500}).status_code == 422
        assert client.get('/api/exports/missing').status_code == 404
        response = client.post('/api/exports', json=small_project().model_dump())
        assert response.status_code == 202
        job_id = response.json()['id']
        result = wait_for_job(service, job_id)
        assert result['status'] == 'completed', result
        assert client.get(f'/api/exports/{job_id}').json()['status'] == 'completed'
        downloaded = client.get(result['files']['final'])
        assert downloaded.status_code == 200
        assert downloaded.content[:4] == b'RIFF'
        assert client.get(f'/api/exports/{job_id}/files/project_snapshot.json').status_code == 404
