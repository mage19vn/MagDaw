from __future__ import annotations

from copy import deepcopy
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictInt, model_validator

Nonnegative = Annotated[float, Field(ge=0)]
Positive = Annotated[float, Field(gt=0)]
EntityId = Annotated[str, Field(min_length=1)]
EntityName = Annotated[str, Field(min_length=1)]


class DomainModel(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True, allow_inf_nan=False)


class Note(DomainModel):
    id: EntityId
    pitch: Annotated[StrictInt, Field(ge=0, le=127)]
    start_beat: Nonnegative
    length_beat: Positive
    velocity: Annotated[StrictInt, Field(ge=1, le=127)]


class Clip(DomainModel):
    id: EntityId
    name: EntityName
    start_beat: Nonnegative
    length_beats: Positive
    notes: list[Note]

    @model_validator(mode='after')
    def notes_fit(self) -> Clip:
        if any(n.start_beat + n.length_beat > self.length_beats + 1e-8 for n in self.notes):
            raise ValueError('Note vượt clip; hãy mở rộng clip trước khi lưu.')
        return self


class InstrumentConfig(DomainModel):
    preset: Literal['auto', 'sine', 'triangle', 'sawtooth', 'square']


class Track(DomainModel):
    id: EntityId
    name: EntityName
    program: Annotated[StrictInt, Field(ge=0, le=127)]
    is_drum: StrictBool
    instrument_config: InstrumentConfig
    volume_db: Annotated[float, Field(ge=-60, le=6)]
    pan: Annotated[float, Field(ge=-1, le=1)]
    mute: StrictBool
    solo: StrictBool
    clips: list[Clip]


class CompressorSettings(DomainModel):
    bypass: StrictBool
    threshold_db: Annotated[float, Field(ge=-60, le=0)]
    ratio: Annotated[float, Field(ge=1, le=20)]
    attack_ms: Annotated[float, Field(ge=.1, le=100)]
    release_ms: Annotated[float, Field(ge=10, le=1000)]


class ReverbSettings(DomainModel):
    bypass: StrictBool
    wet: Annotated[float, Field(ge=0, le=1)]
    room_size: Annotated[float, Field(ge=0, le=1)]


class LimiterSettings(DomainModel):
    bypass: StrictBool
    ceiling_db: Annotated[float, Field(ge=-12, le=0)]


class Master(DomainModel):
    gain_bypass: StrictBool = False
    gain_db: Annotated[float, Field(ge=-24, le=12)]
    compressor: CompressorSettings
    reverb: ReverbSettings
    limiter: LimiterSettings


class Loop(DomainModel):
    enabled: StrictBool
    start_beat: Nonnegative
    end_beat: Positive

    @model_validator(mode='after')
    def valid_range(self) -> Loop:
        if self.end_beat <= self.start_beat:
            raise ValueError('Điểm kết thúc loop phải sau điểm bắt đầu.')
        return self


DEFAULT_MASTER = {
    'gain_bypass': False, 'gain_db': 0,
    'compressor': {'bypass': False, 'threshold_db': -18, 'ratio': 3, 'attack_ms': 10, 'release_ms': 100},
    'reverb': {'bypass': False, 'wet': .2, 'room_size': .5},
    'limiter': {'bypass': False, 'ceiling_db': -1},
}


def migrate_project(value: Any) -> dict[str, Any]:
    """Nâng schema 0 sang 1; không suy đoán phiên bản tương lai."""
    if not isinstance(value, dict):
        raise ValueError('Project phải là một đối tượng JSON.')
    version = value.get('schema_version')
    if type(version) is not int:
        raise ValueError('Thiếu schema_version nguyên của project.')
    if version > 1:
        raise ValueError(f'Phiên bản project {version} chưa được hỗ trợ; ứng dụng hỗ trợ đến phiên bản 1.')
    migrated = deepcopy(value)
    if version == 0:
        migrated['schema_version'] = 1
        migrated.setdefault('master', deepcopy(DEFAULT_MASTER))
        migrated.setdefault('loop', {'enabled': False, 'start_beat': 0, 'end_beat': 16})
        tracks = migrated.get('tracks', [])
        if not isinstance(tracks, list) or any(not isinstance(track, dict) for track in tracks):
            raise ValueError('Danh sách track của schema 0 không hợp lệ.')
        for track in tracks:
            track.setdefault('instrument_config', {'preset': 'auto'})
    return migrated


class Project(DomainModel):
    schema_version: Literal[1]
    id: EntityId
    name: EntityName
    bpm: Positive
    time_signature: list[StrictInt]
    tracks: list[Track]
    loop: Loop
    master: Master

    @model_validator(mode='before')
    @classmethod
    def migrate(cls, value: Any) -> dict[str, Any]:
        return migrate_project(value)

    @model_validator(mode='after')
    def validate_entities(self) -> Project:
        if len(self.time_signature) != 2 or not 1 <= self.time_signature[0] <= 32 or self.time_signature[1] not in (1, 2, 4, 8, 16, 32):
            raise ValueError('Số chỉ nhịp phải có tử số 1–32 và mẫu số 1, 2, 4, 8, 16 hoặc 32.')
        if not self.name.strip() or any(not track.name.strip() or any(not clip.name.strip() for clip in track.clips) for track in self.tracks):
            raise ValueError('Tên project, track và clip không được để trống.')
        ids = [self.id]
        for track in self.tracks:
            ids.append(track.id)
            for clip in track.clips:
                ids.append(clip.id)
                ids.extend(note.id for note in clip.notes)
        if any(not entity_id.strip() for entity_id in ids):
            raise ValueError('ID không được để trống.')
        if len(set(ids)) != len(ids):
            raise ValueError('ID của project, track, clip và note phải duy nhất.')
        return self


def audible_tracks(project: Project) -> list[Track]:
    has_solo = any(track.solo for track in project.tracks)
    return [track for track in project.tracks if not track.mute and (not has_solo or track.solo)]


def project_end_beat(project: Project) -> float:
    return max([4.0] + [clip.start_beat + clip.length_beats for track in project.tracks for clip in track.clips])


def beat_to_seconds(beat: float, bpm: float) -> float:
    return beat * 60 / bpm
