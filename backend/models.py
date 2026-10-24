"""Pydantic models for DAW project data and API payloads."""

from __future__ import annotations

from pydantic import BaseModel, Field, field_validator, model_validator


class Note(BaseModel):
    id: str
    pitch: int = Field(ge=0, le=127)
    start_beat: float = Field(ge=0)
    length_beat: float = Field(gt=0)
    velocity: int = Field(ge=1, le=127)


class Clip(BaseModel):
    id: str
    name: str = ""
    start_beat: float = Field(ge=0)
    length_beats: float = Field(gt=0)
    notes: list[Note] = []

    @model_validator(mode="after")
    def notes_must_fit_inside_clip(self) -> "Clip":
        for note in self.notes:
            if note.start_beat + note.length_beat > self.length_beats + 1e-9:
                raise ValueError(
                    f"Note {note.id} vuot khoi clip {self.id} "
                    f"(bat dau {note.start_beat}, dai {note.length_beat}, "
                    f"clip dai {self.length_beats})"
                )
        return self


class Track(BaseModel):
    id: str
    name: str = ""
    program: int = Field(ge=0, le=127)
    is_drum: bool = False
    volume_db: float = Field(default=0.0, ge=-60.0, le=12.0)
    pan: float = Field(default=0.0, ge=-1.0, le=1.0)
    mute: bool = False
    solo: bool = False
    clips: list[Clip] = []


class LoopRange(BaseModel):
    start_beat: float = Field(default=0.0, ge=0)
    end_beat: float = Field(default=0.0, ge=0)
    enabled: bool = False

    @model_validator(mode="after")
    def end_must_follow_start(self) -> "LoopRange":
        if self.enabled and self.end_beat <= self.start_beat:
            raise ValueError("Loop end_beat phai lon hon start_beat")
        return self


class MasterSettings(BaseModel):
    master_gain_db: float = Field(default=0.0, ge=-24.0, le=12.0)
    compressor_enabled: bool = True
    compressor_threshold_db: float = Field(default=-18.0, ge=-60.0, le=0.0)
    compressor_ratio: float = Field(default=3.0, ge=1.0, le=20.0)
    reverb_enabled: bool = True
    reverb_wet: float = Field(default=0.2, ge=0.0, le=1.0)
    limiter_enabled: bool = True
    limiter_ceiling_db: float = Field(default=-1.0, ge=-12.0, le=0.0)


class Project(BaseModel):
    schema_version: int = 1
    name: str = ""
    bpm: float = Field(gt=0)
    time_signature: tuple[int, int] = (4, 4)
    tracks: list[Track] = []
    loop_range: LoopRange = LoopRange()
    master_settings: MasterSettings = MasterSettings()

    @field_validator("time_signature")
    @classmethod
    def time_signature_must_be_positive(cls, value: tuple[int, int]) -> tuple[int, int]:
        beats, beat_unit = value
        if beats <= 0 or beat_unit <= 0:
            raise ValueError("Time signature phai co ca hai thanh phan duong")
        return value


def audible_tracks(project: Project) -> list[Track]:
    """Return tracks that should be heard/exported after mute/solo rules.

    If any track is soloed, only soloed tracks that are not muted play.
    Otherwise every non-muted track plays.
    """
    soloed = [t for t in project.tracks if t.solo]
    if soloed:
        return [t for t in soloed if not t.mute]
    return [t for t in project.tracks if not t.mute]


def beat_to_seconds(beat: float, bpm: float) -> float:
    return beat * 60.0 / bpm


def seconds_to_beat(seconds: float, bpm: float) -> float:
    return seconds * bpm / 60.0
