"""Export pipeline: Project -> PrettyMIDI -> per-track render -> mixer
-> mix -> pedalboard master -> WAV files (plus the MIDI file itself)."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import soundfile as sf

from compose import project_duration_seconds, project_to_pretty_midi
from effects import apply_master
from models import Project, audible_tracks
from render import (
    DEFAULT_SAMPLE_RATE,
    TAIL_SECONDS,
    apply_volume_pan,
    check_audio,
    is_silent,
    mix_tracks,
    peak_db,
    render_instrument_audio,
    to_stereo,
)

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "output"

MIDI_FILENAME = "bai_hat.mid"
PREVIEW_FILENAME = "bai_hat_preview.wav"
FINAL_FILENAME = "bai_hat_final.wav"

ALLOWED_DOWNLOADS = {MIDI_FILENAME, PREVIEW_FILENAME, FINAL_FILENAME}


def _write_wav(path: Path, audio: np.ndarray, sample_rate: int) -> None:
    """Write (channels, samples) float32 audio as a WAV file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(path), audio.T, sample_rate, subtype="FLOAT")


def export_project(
    project: Project, output_dir: Path = OUTPUT_DIR
) -> dict:
    """Run the full export pipeline and return file info, warnings, peaks.

    Preview WAV: mixer applied, no master effects. Final WAV: preview audio
    through the pedalboard master chain. Raises ValueError with a Vietnamese
    message when there is nothing audible to export.
    """
    tracks = audible_tracks(project)
    if not tracks:
        raise ValueError(
            "Khong co track nao dang nghe duoc de xuat "
            "(tat ca track deu bi mute hoac khong co track nao)."
        )

    midi = project_to_pretty_midi(project, tracks=tracks)
    midi_path = output_dir / MIDI_FILENAME
    output_dir.mkdir(parents=True, exist_ok=True)
    midi.write(str(midi_path))

    sample_rate = DEFAULT_SAMPLE_RATE
    tail_samples = int(TAIL_SECONDS * sample_rate)
    rendered: list[np.ndarray] = []
    warnings: list[str] = []
    seen_warnings: set[str] = set()
    for index, track in enumerate(tracks):
        audio, track_warnings = render_instrument_audio(midi, index, sample_rate)
        for warning in track_warnings:
            if warning not in seen_warnings:
                seen_warnings.add(warning)
                warnings.append(warning)
        rendered.append(apply_volume_pan(audio, track.volume_db, track.pan))

    mixed = mix_tracks(rendered)
    if mixed.shape[1] == 0:
        mixed = np.zeros((2, tail_samples), dtype=np.float32)
    content_seconds = project_duration_seconds(project)
    expected_samples = int(content_seconds * sample_rate) + tail_samples
    if mixed.shape[1] < expected_samples:
        mixed = np.pad(
            mixed, ((0, 0), (0, expected_samples - mixed.shape[1]))
        )
    mixed = to_stereo(mixed)
    problems = check_audio(mixed)
    if problems:
        raise ValueError("Khong xuat duoc am thanh: " + "; ".join(problems))
    if is_silent(mixed):
        warnings.append(
            "Ban nhac gan nhu im lang. Neu project chi co track trong, "
            "ban render sine tam thoi khong tao ra tieng trong; hay them "
            "track co cao do hoac dung SoundFont de nghe duoc tieng trong."
        )

    preview_path = output_dir / PREVIEW_FILENAME
    _write_wav(preview_path, mixed, sample_rate)

    final_audio = apply_master(mixed, project.master_settings, sample_rate)
    final_problems = check_audio(final_audio)
    if final_problems:
        raise ValueError("Khong xuat duoc ban final: " + "; ".join(final_problems))
    final_path = output_dir / FINAL_FILENAME
    _write_wav(final_path, final_audio, sample_rate)

    return {
        "midi": MIDI_FILENAME,
        "preview_wav": PREVIEW_FILENAME,
        "final_wav": FINAL_FILENAME,
        "warnings": warnings,
        "peaks": {
            "preview_db": peak_db(mixed),
            "final_db": peak_db(final_audio),
        },
        "duration_seconds": float(mixed.shape[1] / sample_rate),
        "sample_rate": sample_rate,
    }
