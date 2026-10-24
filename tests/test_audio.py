from copy import deepcopy

import numpy as np
import pretty_midi
import pytest

from backend.app.audio import render
from backend.app.audio.compose import compose_midi
from backend.app.audio.effects import apply_master
from backend.app.audio.render import SAMPLE_RATE, apply_track_mixer, normalize_channels, render_track, verify_audio
from backend.app.domain.models import DEFAULT_MASTER, Master, Project


def project_fixture() -> Project:
    return Project.model_validate({
        'schema_version': 1, 'id': 'p', 'name': 'Thử âm thanh', 'bpm': 100, 'time_signature': [4, 4],
        'tracks': [
            {'id': f't-{index}', 'name': name, 'program': program, 'is_drum': drum,
             'instrument_config': {'preset': 'auto'}, 'volume_db': -6, 'pan': 0,
             'mute': False, 'solo': False, 'clips': [
                {'id': f'c-{index}', 'name': 'Đoạn', 'start_beat': 4, 'length_beats': 4,
                 'notes': [{'id': f'n-{index}', 'pitch': pitch, 'start_beat': .5,
                            'length_beat': 1, 'velocity': 90}]}]}
            for index, (name, program, drum, pitch) in enumerate([
                ('Piano', 0, False, 60), ('Strings', 48, False, 67), ('Trống', 0, True, 36)])
        ],
        'loop': {'enabled': False, 'start_beat': 0, 'end_beat': 16}, 'master': deepcopy(DEFAULT_MASTER),
    })


def test_midi_round_trip_preserves_instruments_notes_tempo_signature(tmp_path):
    project = project_fixture()
    path = tmp_path / 'song.mid'
    compose_midi(project).write(str(path))
    midi = pretty_midi.PrettyMIDI(str(path))
    assert [(i.program, i.is_drum) for i in midi.instruments] == [(0, False), (48, False), (0, True)]
    assert [i.name for i in midi.instruments] == ['Piano', 'Strings', 'Trong']
    note = midi.instruments[0].notes[0]
    assert note.pitch == 60 and note.velocity == 90
    assert note.start == pytest.approx(2.7, abs=.002)
    assert note.end == pytest.approx(3.3, abs=.002)
    assert midi.get_tempo_changes()[1][0] == pytest.approx(100)
    assert midi.time_signature_changes[0].numerator == 4


def test_midi_audible_policy_mute_wins_solo():
    project = project_fixture()
    project.tracks[0].solo = True
    assert len(compose_midi(project).instruments) == 1
    project.tracks[0].mute = True
    assert compose_midi(project).instruments == []


def test_overlap_preserves_both_notes():
    project = project_fixture()
    project.tracks[0].clips.append(project.tracks[0].clips[0].model_copy(deep=True))
    midi = compose_midi(project)
    assert len(midi.instruments[0].notes) == 2


def test_missing_soundfont_uses_real_pretty_midi_sine(monkeypatch):
    monkeypatch.setattr(render, 'SOUNDFONT_PATH', '/not/a/soundfont.sf2')
    project = project_fixture()
    sample_count = int((4.8 + 2) * SAMPLE_RATE)
    audio, warnings = render_track(project.tracks[0], project.bpm, sample_count)
    assert audio.shape == (2, sample_count)
    assert audio.dtype == np.float32
    assert verify_audio(audio)['peak'] > 0
    assert warnings and 'sine' in warnings[0]
    assert np.max(np.abs(audio[:, :int(2.6 * SAMPLE_RATE)])) == 0


def test_missing_soundfont_drums_are_explicitly_silent(monkeypatch):
    monkeypatch.setattr(render, 'SOUNDFONT_PATH', '')
    project = project_fixture()
    audio, warnings = render_track(project.tracks[2], project.bpm, 6 * SAMPLE_RATE)
    assert not np.any(audio)
    assert any('drum' in warning for warning in warnings)


def test_channels_padding_mixer_db_pan():
    source = np.ones(8, dtype=np.float32)
    audio = normalize_channels(source, 12)
    assert audio.shape == (2, 12)
    assert np.all(audio[:, 8:] == 0)
    left = apply_track_mixer(audio, -6.020599913, -1)
    assert left[0, 0] == pytest.approx(.5)
    assert abs(left[1, 0]) < 1e-6
    right = apply_track_mixer(audio, 0, 1)
    assert abs(right[0, 0]) < 1e-6
    assert right[1, 0] == pytest.approx(1)
    center = apply_track_mixer(audio, 0, 0)
    assert center[0, 0] == pytest.approx(2 ** -.5)


def test_master_gain_bypass_and_finite():
    settings = deepcopy(DEFAULT_MASTER)
    settings['compressor']['bypass'] = True
    settings['reverb']['bypass'] = True
    settings['limiter']['bypass'] = True
    settings['gain_db'] = -6.020599913
    audio = np.ones((2, 4410), dtype=np.float32) * .2
    result = apply_master(audio, Master.model_validate(settings))
    assert result.shape == audio.shape
    assert result[0, -1] == pytest.approx(.1, abs=1e-5)
    assert np.isfinite(result).all()


def test_verify_rejects_nonfinite_and_empty():
    for audio in [np.empty((2, 0), dtype=np.float32), np.full((2, 8), np.nan, dtype=np.float32)]:
        with pytest.raises(ValueError):
            verify_audio(audio)


def test_limiter_adapter_honors_ceiling_and_gain_bypass():
    from backend.app.audio.effects import apply_master
    from backend.app.domain.models import Master
    from backend.app.song_data import SAMPLE_PROJECT
    master = Master.model_validate(SAMPLE_PROJECT['master'])
    master.compressor.bypass = True
    master.reverb.bypass = True
    master.limiter.ceiling_db = -6
    audio = np.ones((2, SAMPLE_RATE), dtype=np.float32) * 2
    assert np.max(np.abs(apply_master(audio, master))) <= 10 ** (-6 / 20) + 1e-6
    master.limiter.bypass = True
    master.gain_db = -12
    master.gain_bypass = True
    np.testing.assert_allclose(apply_master(audio, master), audio, atol=1e-6)
