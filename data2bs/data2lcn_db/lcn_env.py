"""Zentrale Aufloesung der privaten LCN-Umgebungsdatei fuer Python-Skripte."""

from __future__ import annotations

import os
from pathlib import Path


def lcn_env_path() -> Path:
    """Liefert den zentralen lcn.env-Pfad, optional via LCN_ENV_FILE ueberschrieben."""
    configured = os.getenv("LCN_ENV_FILE", "").strip()
    if configured:
        return Path(configured).expanduser().resolve()

    project_root = Path(__file__).resolve().parents[2]
    return project_root.parent / "private" / "lcn.env"

