"""Convert Project models to PrettyMIDI objects."""

from __future__ import annotations

import pretty_midi

from models import Project, Track, beat_to_seconds


def project_to_pretty_midi(
    project: Project, tracks: list[Track] | None = None
) -> pretty_midi.PrettyMIDI:
    """Build a PrettyMIDI from the project.

    Note times follow absolute_beat = clip.start_beat + note.start_beat and
    seconds = absolute_beat * 60 / bpm. Drum tracks use channel 9
    (is_drum=True on the instrument).
    """
    midi = pretty_midi.PrettyMIDI(resolution=480, initial_tempo=project.bpm)
    for track in tracks if tracks is not None else project.tracks:
        instrument = pretty_midi.Instrument(
            program=track.program, is_drum=track.is_drum, name=track.name
        )
        for clip in track.clips:
            for note in clip.notes:
                start = beat_to_seconds(
                    clip.start_beat + note.start_beat, project.bpm
                )
                end = beat_to_seconds(
                    clip.start_beat + note.start_beat + note.length_beat,
                    project.bpm,
                )
                instrument.notes.append(
                    pretty_midi.Note(
                        velocity=note.velocity,
                        pitch=note.pitch,
                        start=start,
                        end=end,
                    )
                )
        midi.instruments.append(instrument)
    return midi


def project_duration_seconds(project: Project) -> float:
    """Length of the musical content in seconds (without reverb tail)."""
    end_beat = 0.0
    for track in project.tracks:
        for clip in track.clips:
            end_beat = max(end_beat, clip.start_beat + clip.length_beats)
    return beat_to_seconds(end_beat, project.bpm)
