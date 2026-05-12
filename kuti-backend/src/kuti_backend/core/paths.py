from __future__ import annotations

from pathlib import Path


def repo_root() -> Path:
    return Path(__file__).resolve().parents[4]


def default_data_dir() -> Path:
    return repo_root() / "kuti-data"
