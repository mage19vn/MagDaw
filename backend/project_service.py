"""Project lifecycle: create, validate, serialize, load, save."""

from __future__ import annotations

import json
from pathlib import Path

from pydantic import ValidationError

from models import Project
from song_data import get_sample_project


def create_project() -> Project:
    """Create a new project from the sample song data."""
    return Project(**get_sample_project())


def validate_project(data: dict) -> tuple[Project | None, list[str]]:
    """Validate raw project data; returns (project, Vietnamese error list)."""
    try:
        return Project(**data), []
    except ValidationError as exc:
        errors = []
        for error in exc.errors():
            location = ".".join(str(part) for part in error["loc"])
            errors.append(f"{location}: {error['msg']}")
        return None, errors


def serialize_project(project: Project) -> dict:
    return project.model_dump(mode="json")


def load_project(data: dict) -> Project:
    """Load a project or raise ValueError with a Vietnamese message."""
    project, errors = validate_project(data)
    if project is None:
        raise ValueError("File project khong hop le: " + "; ".join(errors))
    return project


def save_project(project: Project, path: str | Path) -> Path:
    """Write project JSON to path and return the path."""
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(
        json.dumps(serialize_project(project), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return target


def restore_autosave(data: dict) -> Project:
    """Restore a project from autosave data (same validation as load)."""
    return load_project(data)
