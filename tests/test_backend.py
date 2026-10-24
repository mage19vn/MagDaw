"""Backend tests: beat conversion, notes, validation, save/load, export."""

import sys
from pathlib import Path

import numpy as np
import pretty_midi
import pytest
import soundfile as sf

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from compose import project_to_pretty_midi  # noqa: E402
from export_service import export_project  # noqa: E402
from models import (  # noqa: E402
    Project,
    audible_tracks,
    beat_to_seconds,
    seconds_to_beat,
)
from project_service import (  # noqa: E402
    create_project,
    load_project,
    save_project,
    serialize_project,
    validate_project,
)


def test_beat_seconds_roundtrip():
    assert beat_to_seconds(64, 100) == pytest.approx(38.4)
    assert seconds_to_beat(38.4, 100) == pytest.approx(64)
    assert beat_to_seconds(0, 120) == 0


def test_sample_project_shape():
    project = create_project()
    assert project.bpm == 100
    assert project.time_signature == (4, 4)
    assert len(project.tracks) == 4
    assert project.tracks[3].is_drum is True
    assert project.tracks[0].program == 0
    assert project.tracks[1].program == 48
    assert project.tracks[2].program == 32
    total_beats = max(
        clip.start_beat + clip.length_beats
        for track in project.tracks
        for clip in track.clips
    )
    assert total_beats == 64


def test_note_validation_rejects_bad_pitch_and_velocity():
    data = serialize_project(create_project())
    data["tracks"][0]["clips"][0]["notes"][0]["pitch"] = 200
    _project, errors = validate_project(data)
    assert errors
    data = serialize_project(create_project())
    data["tracks"][0]["clips"][0]["notes"][0]["velocity"] = 0
    _project, errors = validate_project(data)
    assert errors


def test_note_outside_clip_rejected():
    data = serialize_project(create_project())
    data["tracks"][0]["clips"][0]["notes"][0]["start_beat"] = 63
    data["tracks"][0]["clips"][0]["notes"][0]["length_beat"] = 4
    _project, errors = validate_project(data)
    assert errors


def test_bpm_must_be_positive():
    data = serialize_project(create_project())
    data["bpm"] = 0
    _project, errors = validate_project(data)
    assert errors


def test_save_load_roundtrip(tmp_path):
    project = create_project()
    path = save_project(project, tmp_path / "project.json")
    loaded = load_project(__import__("json").loads(path.read_text()))
    assert serialize_project(loaded) == serialize_project(project)


def test_audible_tracks_mute_solo_rules():
    project = create_project()
    assert len(audible_tracks(project)) == 4
    project.tracks[0].mute = True
    assert len(audible_tracks(project)) == 3
    project.tracks[1].solo = True
    assert [t.id for t in audible_tracks(project)] == ["track-chords"]
    project.tracks[1].mute = True
    assert audible_tracks(project) == []


def test_midi_conversion_matches_sample():
    project = create_project()
    midi = project_to_pretty_midi(project)
    assert len(midi.instruments) == 4
    programs = [i.program for i in midi.instruments]
    assert programs == [0, 48, 32, 0]
    assert midi.instruments[3].is_drum is True
    melody_notes = midi.instruments[0].notes
    assert melody_notes[0].pitch == 64
    assert melody_notes[0].start == pytest.approx(0.0)
    assert melody_notes[0].end == pytest.approx(0.6)


def test_export_produces_files_and_valid_audio(tmp_path):
    project = create_project()
    result = export_project(project, output_dir=tmp_path)
    assert result["warnings"], "Thieu SoundFont phai co canh bao tieng Viet"
    assert any("SoundFont" in w for w in result["warnings"])
    for key in ("midi", "preview_wav", "final_wav"):
        assert (tmp_path / result[key]).is_file()

    midi = pretty_midi.PrettyMIDI(str(tmp_path / result["midi"]))
    assert len(midi.instruments) == 4
    assert midi.instruments[3].is_drum is True

    for key in ("preview_wav", "final_wav"):
        info = sf.info(str(tmp_path / result[key]))
        assert info.samplerate == 44100
        audio, _ = sf.read(str(tmp_path / result[key]), always_2d=True)
        assert np.isfinite(audio).all()
        assert float(np.max(np.abs(audio))) > 0.001
        duration = len(audio) / 44100
        assert 40.0 <= duration <= 41.0  # 38.4s music + 2s tail

    assert result["peaks"]["final_db"] <= -0.5  # limiter ceiling -1 dBFS
    assert result["peaks"]["final_db"] > -60.0


def test_limiter_holds_ceiling():
    from effects import apply_master
    from models import MasterSettings
    from render import peak_db

    sample_rate = 44100
    t = np.arange(sample_rate) / sample_rate
    loud = np.repeat(
        (2.0 * np.sin(2 * np.pi * 440 * t)).astype(np.float32)[None, :],
        2,
        axis=0,
    )
    settings = MasterSettings(
        compressor_enabled=False,
        reverb_enabled=False,
        limiter_enabled=True,
        limiter_ceiling_db=-1.0,
    )
    out = apply_master(loud, settings, sample_rate)
    assert peak_db(out) == pytest.approx(-1.0, abs=0.5)


def test_export_all_muted_raises(tmp_path):
    project = create_project()
    for track in project.tracks:
        track.mute = True
    with pytest.raises(ValueError, match="Khong co track"):
        export_project(project, output_dir=tmp_path)
