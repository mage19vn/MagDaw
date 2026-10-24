"""Master effects chain (pedalboard) for exported audio."""

from __future__ import annotations

import numpy as np
from pedalboard import (
    Compressor,
    Gain,
    Limiter,
    Pedalboard,
    Reverb,
)

from models import MasterSettings
from render import DEFAULT_SAMPLE_RATE


def build_effects_chain(settings: MasterSettings) -> Pedalboard:
    """Build Gain -> Compressor -> Reverb -> Limiter in that exact order.

    Disabled effects are skipped, but the Limiter always stays last when
    enabled. Nothing is added after the Limiter.
    """
    effects = [Gain(gain_db=settings.master_gain_db)]
    if settings.compressor_enabled:
        effects.append(
            Compressor(
                threshold_db=settings.compressor_threshold_db,
                ratio=settings.compressor_ratio,
            )
        )
    if settings.reverb_enabled:
        effects.append(Reverb(room_size=0.5, wet_level=settings.reverb_wet))
    if settings.limiter_enabled:
        effects.append(Limiter(threshold_db=settings.limiter_ceiling_db))
    return Pedalboard(effects)


def apply_master(
    audio: np.ndarray,
    settings: MasterSettings,
    sample_rate: int = DEFAULT_SAMPLE_RATE,
) -> np.ndarray:
    """Apply the master chain to (channels, samples) audio.

    Pedalboard expects (samples, channels) for multi-channel audio, so the
    array is transposed before and after processing. The chain is primed
    with a 200 ms copy of the audio start first: pedalboard dynamics
    processors need a short attack time to engage, and without priming the
    very first transient would overshoot the limiter ceiling.
    """
    board = build_effects_chain(settings)
    warm = min(audio.shape[1], int(0.2 * sample_rate))
    if warm > 0:
        padded = np.concatenate([audio[:, :warm], audio], axis=1)
        processed = board(padded.T, sample_rate).T[:, warm:]
    else:
        processed = board(audio.T, sample_rate).T
    return np.ascontiguousarray(processed, dtype=np.float32)
