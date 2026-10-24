from __future__ import annotations

import numpy as np
from pedalboard import Clipping, Compressor, Gain, Limiter, Pedalboard, Reverb

from backend.app.audio.render import AudioBuffer, SAMPLE_RATE, verify_audio
from backend.app.domain.models import Master

EFFECT_CATALOG = {
    'gain': {'parameter': 'gain_db', 'default': 0, 'range': [-24, 12], 'unit': 'dB'},
    'compressor': {'defaults': {'threshold_db': -18, 'ratio': 3, 'attack_ms': 10, 'release_ms': 100}},
    'reverb': {'defaults': {'wet': .2, 'room_size': .5}},
    'limiter': {'defaults': {'ceiling_db': -1}},
}
MASTER_MAPPING_WARNING = ('Tone.js và pedalboard dùng thuật toán compressor/reverb/limiter khác nhau. '
                          'room_size ánh xạ trực tiếp vào Freeverb của Tone.js và Reverb của pedalboard '
                          'khi xuất; wet, gain, threshold, ratio, attack, release và ceiling được chuyển qua adapter. '
                          'Limiter pedalboard tự bù gain về 0 dBFS; adapter dùng Clipping có sẵn làm hard ceiling cuối tầng limiter, '
                          'không tăng gain sau limiter. Tên track MIDI chuyển sang ASCII để tương thích charset; '
                          'tên tiếng Việt được giữ trong JSON. MIDI chỉ lưu note, program, drum và nhịp, không lưu mixer/master hay âm sắc synth.')


def build_master(master: Master) -> Pedalboard:
    effects = [] if master.gain_bypass else [Gain(gain_db=master.gain_db)]
    compressor = master.compressor
    if not compressor.bypass:
        effects.append(Compressor(threshold_db=compressor.threshold_db, ratio=compressor.ratio,
                                  attack_ms=compressor.attack_ms, release_ms=compressor.release_ms))
    reverb = master.reverb
    if not reverb.bypass:
        effects.append(Reverb(room_size=reverb.room_size, wet_level=reverb.wet,
                              dry_level=1.0 - reverb.wet, width=1.0, damping=.5))
    if not master.limiter.bypass:
        # Pedalboard Limiter applies makeup to 0 dBFS; its adapter needs a library hard ceiling.
        effects.extend([Limiter(threshold_db=master.limiter.ceiling_db, release_ms=100),
                        Clipping(threshold_db=master.limiter.ceiling_db)])
    return Pedalboard(effects)


def apply_master(audio: AudioBuffer, master: Master) -> AudioBuffer:
    verify_audio(audio)
    result = np.asarray(build_master(master)(audio, SAMPLE_RATE, reset=True), dtype=np.float32)
    verify_audio(result)
    return result
