"""Render PrettyMIDI instruments to float32 audio arrays.

Internal arrays are float32 with shape (channels, samples). SoundFont
rendering is optional: when no valid SoundFont or FluidSynth is available,
rendering falls back to pretty_midi.synthesize() (sine based) and reports a
Vietnamese warning. The sine branch does NOT reproduce General MIDI
instruments accurately and may produce near-silence for drum tracks.
"""

from __future__ import annotations

import os

import numpy as np
import pretty_midi

SOUNDFONT_PATH = os.environ.get("SOUNDFONT_PATH", "")

DEFAULT_SAMPLE_RATE = 44100
TAIL_SECONDS = 2.0


class RenderWarning(str):
    """A warning message in Vietnamese, returned alongside audio."""


def _soundfont_available() -> bool:
    return bool(SOUNDFONT_PATH) and os.path.isfile(SOUNDFONT_PATH)


def render_instrument_audio(
    midi: pretty_midi.PrettyMIDI,
    instrument_index: int,
    sample_rate: int = DEFAULT_SAMPLE_RATE,
) -> tuple[np.ndarray, list[str]]:
    """Render one instrument of a multi-instrument MIDI to (channels, samples).

    Returns the audio and a list of Vietnamese warnings (empty on the
    SoundFont path, one entry on the sine fallback path).
    """
    warnings: list[str] = []
    single = pretty_midi.PrettyMIDI(resolution=midi.resolution)
    single.instruments.append(midi.instruments[instrument_index])
    if _soundfont_available():
        try:
            audio = single.fluidsynth(fs=sample_rate, sf2_path=SOUNDFONT_PATH)
            return _to_channels_first(audio), warnings
        except Exception:
            warnings.append(
                "Khong render duoc bang SoundFont (FluidSynth gap loi), "
                "da chuyen sang render sine tam thoi."
            )
    else:
        warnings.append(
            "Khong tim thay SoundFont (SOUNDFONT_PATH chua duoc dat hoac file "
            "khong ton tai). Ban nhac duoc render bang song sine tam thoi: "
            "am sac khong giong nhac cu General MIDI that, va track trong "
            "co the gan nhu khong nghe thay."
        )
    audio = single.synthesize(fs=sample_rate)
    # pretty_midi divides by the peak when synthesizing; a silent instrument
    # (e.g. drums in the sine branch) yields NaN, which must not propagate.
    audio = np.nan_to_num(np.asarray(audio, dtype=np.float32), nan=0.0)
    return _to_channels_first(audio), warnings


def _to_channels_first(audio: np.ndarray) -> np.ndarray:
    """Normalize mono/stereo audio to float32 shape (channels, samples)."""
    audio = np.asarray(audio, dtype=np.float32)
    if audio.ndim == 1:
        audio = audio[np.newaxis, :]
    elif audio.ndim == 2 and audio.shape[0] > 2:
        # pretty_midi returns (samples, channels) for stereo input arrays.
        audio = audio.T
    if audio.shape[0] > 2:
        audio = audio[:2, :]
    return np.ascontiguousarray(audio, dtype=np.float32)


def to_stereo(audio: np.ndarray) -> np.ndarray:
    """Convert (channels, samples) to stereo (2, samples)."""
    if audio.shape[0] == 1:
        return np.repeat(audio, 2, axis=0)
    return audio[:2, :]


def apply_volume_pan(
    audio: np.ndarray, volume_db: float, pan: float
) -> np.ndarray:
    """Apply per-track volume (dB) and constant-power pan before mixing."""
    gain = 10.0 ** (volume_db / 20.0)
    left_gain = np.cos((pan + 1.0) * np.pi / 4.0)
    right_gain = np.sin((pan + 1.0) * np.pi / 4.0)
    stereo = to_stereo(audio) * gain
    stereo[0, :] *= left_gain
    stereo[1, :] *= right_gain
    return stereo


def mix_tracks(tracks_audio: list[np.ndarray]) -> np.ndarray:
    """Mix per-track stereo arrays into one stereo array."""
    if not tracks_audio:
        return np.zeros((2, 0), dtype=np.float32)
    length = max(a.shape[1] for a in tracks_audio)
    mixed = np.zeros((2, length), dtype=np.float32)
    for audio in tracks_audio:
        mixed[:, : audio.shape[1]] += audio
    return mixed


def check_audio(audio: np.ndarray) -> list[str]:
    """Validate rendered audio; returns fatal Vietnamese problem descriptions.

    Silence is not fatal here: a sine render of a drum-only project is
    legitimately near-silent, and that case is reported as a warning by the
    caller instead of failing the export.
    """
    problems: list[str] = []
    if audio.size == 0:
        problems.append("Am thanh render ra rong (khong co mau nao).")
        return problems
    if not np.isfinite(audio).all():
        problems.append("Am thanh chua gia tri NaN hoac Inf.")
    return problems


def is_silent(audio: np.ndarray) -> bool:
    return audio.size == 0 or float(np.max(np.abs(audio))) == 0.0


def peak_db(audio: np.ndarray) -> float:
    """Peak level in dBFS; -inf for empty/silent audio."""
    if audio.size == 0:
        return float("-inf")
    peak = float(np.max(np.abs(audio)))
    if peak == 0.0:
        return float("-inf")
    return 20.0 * float(np.log10(peak))
