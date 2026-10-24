"""Sample song data only.

This module contains no conversion or rendering logic. Converting this data
into a Project model or into MIDI lives in project_service.py / compose.py.
"""

import copy

# Pitch reference: C4 = MIDI 60.
C4, D4, E4, F4, G4, A4, B4 = 60, 62, 64, 65, 67, 69, 71
C5, D5, E5 = 72, 74, 76

# Melody: (bar, start_in_bar, length, pitch). 16 bars, C major, original
# motif with light variation, rests and a closing phrase.
_MELODY = [
    (0, 0, 1, E4), (0, 1, 1, G4), (0, 2, 2, C5),
    (1, 0, 1, B4), (1, 1, 1, A4), (1, 2, 1, G4), (1, 3, 1, E4),
    (2, 0, 1, F4), (2, 1, 1, A4), (2, 2, 2, C5),
    (3, 0, 1, D4), (3, 1, 1, G4), (3, 2, 1, B4),
    (4, 0, 1, E4), (4, 1, 1, G4), (4, 2, 1, E4), (4, 3, 1, C4),
    (5, 0, 2, A4), (5, 2, 1, G4), (5, 3, 1, E4),
    (6, 0, 1, F4), (6, 1, 1, A4), (6, 2, 2, G4),
    (7, 0, 1, G4), (7, 1, 1, B4), (7, 2, 1, D5),
    (8, 0, 1, C5), (8, 1, 1, G4), (8, 2, 2, E4),
    (9, 0, 1, A4), (9, 1, 1, C5), (9, 2, 1, E5), (9, 3, 1, D5),
    (10, 0, 1, F4), (10, 1, 2, A4), (10, 3, 1, C5),
    (11, 0, 1, B4), (11, 1, 1, D5), (11, 2, 2, G4),
    (12, 0, 1, E4), (12, 1, 1, G4), (12, 2, 2, C5),
    (13, 0, 1, A4), (13, 1, 1, G4), (13, 2, 2, E4),
    (14, 0, 1, D4), (14, 1, 1, F4), (14, 2, 1, G4), (14, 3, 1, B4),
    (15, 0, 4, C5),
]

# Chord cycle C - Am - F - G, one chord per bar, repeated 4 times.
_CHORDS = [
    [60, 64, 67],  # C
    [57, 60, 64],  # Am
    [53, 57, 60],  # F
    [55, 59, 62],  # G
]

# Bass: (root, fifth) per bar of the cycle.
_BASS = [(36, 43), (33, 40), (41, 36), (43, 38)]


def _note(note_id: str, pitch: int, start: float, length: float, velocity: int) -> dict:
    return {
        "id": note_id,
        "pitch": pitch,
        "start_beat": start,
        "length_beat": length,
        "velocity": velocity,
    }


def _build_sample_project() -> dict:
    melody_notes = [
        _note(f"mel-{i}", pitch, bar * 4 + start, length, 85)
        for i, (bar, start, length, pitch) in enumerate(_MELODY)
    ]
    chord_notes = []
    note_index = 0
    for bar in range(16):
        for pitch in _CHORDS[bar % 4]:
            chord_notes.append(_note(f"chd-{note_index}", pitch, bar * 4, 4, 65))
            note_index += 1
    bass_notes = []
    note_index = 0
    for bar in range(16):
        root, fifth = _BASS[bar % 4]
        for beat_in_bar, pitch in enumerate([root, root, fifth, root]):
            bass_notes.append(
                _note(f"bas-{note_index}", pitch, bar * 4 + beat_in_bar, 1, 80)
            )
            note_index += 1
    drum_notes = []
    note_index = 0
    for bar in range(16):
        base = bar * 4
        for beat_in_bar in (0, 2):
            drum_notes.append(_note(f"drm-{note_index}", 36, base + beat_in_bar, 0.25, 100))
            note_index += 1
        for beat_in_bar in (1, 3):
            drum_notes.append(_note(f"drm-{note_index}", 38, base + beat_in_bar, 0.25, 95))
            note_index += 1
        for eighth in range(8):
            drum_notes.append(
                _note(f"drm-{note_index}", 42, base + eighth * 0.5, 0.25, 70)
            )
            note_index += 1

    return {
        "schema_version": 1,
        "name": "Bai mau - C Am F G",
        "bpm": 100,
        "time_signature": [4, 4],
        "tracks": [
            {
                "id": "track-melody", "name": "Melody", "program": 0,
                "is_drum": False, "volume_db": 0.0, "pan": 0.0,
                "mute": False, "solo": False,
                "clips": [{"id": "clip-melody", "name": "Melody",
                           "start_beat": 0, "length_beats": 64,
                           "notes": melody_notes}],
            },
            {
                "id": "track-chords", "name": "Chords", "program": 48,
                "is_drum": False, "volume_db": -3.0, "pan": -0.2,
                "mute": False, "solo": False,
                "clips": [{"id": "clip-chords", "name": "Chords",
                           "start_beat": 0, "length_beats": 64,
                           "notes": chord_notes}],
            },
            {
                "id": "track-bass", "name": "Bass", "program": 32,
                "is_drum": False, "volume_db": -2.0, "pan": 0.2,
                "mute": False, "solo": False,
                "clips": [{"id": "clip-bass", "name": "Bass",
                           "start_beat": 0, "length_beats": 64,
                           "notes": bass_notes}],
            },
            {
                "id": "track-drums", "name": "Drums", "program": 0,
                "is_drum": True, "volume_db": -1.0, "pan": 0.0,
                "mute": False, "solo": False,
                "clips": [{"id": "clip-drums", "name": "Drums",
                           "start_beat": 0, "length_beats": 64,
                           "notes": drum_notes}],
            },
        ],
        "loop_range": {"start_beat": 0, "end_beat": 64, "enabled": False},
        "master_settings": {
            "master_gain_db": 0.0,
            "compressor_enabled": True,
            "compressor_threshold_db": -18.0,
            "compressor_ratio": 3.0,
            "reverb_enabled": True,
            "reverb_wet": 0.2,
            "limiter_enabled": True,
            "limiter_ceiling_db": -1.0,
        },
    }


def get_sample_project() -> dict:
    """Return a fresh deep copy of the sample project data."""
    return copy.deepcopy(_build_sample_project())
