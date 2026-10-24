from __future__ import annotations

import unicodedata

import pretty_midi

from backend.app.domain.models import Project, Track, audible_tracks


def track_instrument(track: Track, bpm: float) -> pretty_midi.Instrument:
    instrument = pretty_midi.Instrument(program=track.program, is_drum=track.is_drum, name=unicodedata.normalize('NFKD', track.name.replace('đ', 'd').replace('Đ', 'D')).encode('ascii', 'ignore').decode('ascii') or 'Track')
    seconds_per_beat = 60.0 / bpm
    for clip in track.clips:
        for note in clip.notes:
            start = (clip.start_beat + note.start_beat) * seconds_per_beat
            instrument.notes.append(pretty_midi.Note(
                velocity=note.velocity,
                pitch=note.pitch,
                start=start,
                end=start + note.length_beat * seconds_per_beat,
            ))
    instrument.notes.sort(key=lambda note: (note.start, note.pitch, note.end))
    return instrument


def compose_midi(project: Project, tracks: list[Track] | None = None) -> pretty_midi.PrettyMIDI:
    """Tạo MIDI từ snapshot với cùng chính sách nghe được như playback."""
    midi = pretty_midi.PrettyMIDI(initial_tempo=project.bpm)
    numerator, denominator = project.time_signature
    midi.time_signature_changes.append(pretty_midi.TimeSignature(numerator, denominator, 0))
    for track in audible_tracks(project) if tracks is None else tracks:
        instrument = track_instrument(track, project.bpm)
        midi.instruments.append(instrument)
    return midi
