from __future__ import annotations

import os
from pathlib import Path

SOUNDFONT_PATH = os.environ.get('SOUNDFONT_PATH', '')

import numpy as np
import pretty_midi
from numpy.typing import NDArray

from backend.app.audio.compose import track_instrument
from backend.app.domain.models import Track

SAMPLE_RATE = 44_100
AudioBuffer = NDArray[np.float32]
FALLBACK_WARNING = ('Không có SoundFont/FluidSynth khả dụng: dùng pretty_midi.synthesize dạng sine; '
                    'âm sắc không mô phỏng đầy đủ nhạc cụ và drum track có thể im lặng.')


def normalize_channels(audio: NDArray[np.floating], sample_count: int) -> AudioBuffer:
    values = np.asarray(audio, dtype=np.float32)
    if values.ndim == 1:
        values = np.stack((values, values))
    elif values.ndim == 2 and values.shape[0] not in (1, 2) and values.shape[1] in (1, 2):
        values = values.T
    if values.ndim != 2 or values.shape[0] not in (1, 2):
        raise ValueError('Renderer trả về số kênh không hỗ trợ.')
    if values.shape[0] == 1:
        values = np.repeat(values, 2, axis=0)
    if not np.isfinite(values).all():
        raise ValueError('Renderer trả về NaN hoặc vô cực.')
    result = np.zeros((2, sample_count), dtype=np.float32)
    copied = min(values.shape[1], sample_count)
    result[:, :copied] = values[:, :copied]
    return result


def render_track(track: Track, bpm: float, sample_count: int) -> tuple[AudioBuffer, list[str]]:
    """Render duy nhất một track; caller cấp chiều dài đã gồm đuôi hai giây."""
    if sample_count <= 0:
        raise ValueError('Độ dài render phải lớn hơn không.')
    instrument = track_instrument(track, bpm)
    if not instrument.notes:
        return np.zeros((2, sample_count), dtype=np.float32), []
    midi = pretty_midi.PrettyMIDI(initial_tempo=bpm)
    midi.instruments.append(instrument)
    warnings: list[str] = []
    audio: NDArray[np.floating] | None = None
    if SOUNDFONT_PATH and Path(SOUNDFONT_PATH).is_file():
        try:
            audio = midi.fluidsynth(fs=SAMPLE_RATE, sf2_path=SOUNDFONT_PATH)
        except (ImportError, OSError, ValueError, RuntimeError) as error:
            warnings.append(f'FluidSynth không render được ({type(error).__name__}); chuyển sang sine.')
    if audio is None:
        warnings.append(FALLBACK_WARNING)
        # PrettyMIDI 0.2.10 normalizes zero drum output to NaN; Instrument returns the documented silence directly.
        audio = instrument.synthesize(fs=SAMPLE_RATE) if track.is_drum else midi.synthesize(fs=SAMPLE_RATE)
    if track.instrument_config.preset != 'auto':
        warnings.append(f'Track “{track.name}”: preset synth trình duyệt {track.instrument_config.preset} '
                        'không chuyển nguyên âm sắc sang renderer Python; MIDI program được giữ.')
    result = normalize_channels(audio, sample_count)
    if not track.is_drum and not np.any(result):
        raise ValueError(f'Renderer không tạo tín hiệu cho track “{track.name}”.')
    return result, warnings


def apply_track_mixer(audio: AudioBuffer, volume_db: float, pan: float) -> AudioBuffer:
    """Pan constant-power cho nguồn mono, giữ stereo nếu renderer cung cấp stereo."""
    angle = (pan + 1.0) * np.pi / 4.0
    gains = np.asarray([np.cos(angle), np.sin(angle)], dtype=np.float32)
    return np.asarray(audio * gains[:, None] * (10.0 ** (volume_db / 20.0)), dtype=np.float32)


def verify_audio(audio: AudioBuffer) -> dict[str, float]:
    if audio.ndim != 2 or audio.shape[0] != 2 or audio.shape[1] == 0:
        raise ValueError('Tín hiệu âm thanh rỗng hoặc không phải stereo.')
    if not np.isfinite(audio).all():
        raise ValueError('Tín hiệu âm thanh chứa NaN hoặc vô cực.')
    peak = float(np.max(np.abs(audio)))
    rms = float(np.sqrt(np.mean(np.square(audio, dtype=np.float64))))
    return {'peak': peak, 'rms': rms, 'duration_seconds': audio.shape[1] / SAMPLE_RATE}
