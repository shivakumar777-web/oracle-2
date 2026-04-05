"""
paths_bootstrap — Oracle service import path setup
====================================================
Must run before any `from services.shared...` or ai-router flat imports.

Docker: /app on PYTHONPATH with /app/services/shared and /app/lib.
Local: oracle-2 on PYTHONPATH with services/shared; ai-router on path as directory.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path


def ensure_oracle_sys_path() -> Path:
    """
    Insert sys.path entries for `services.shared` and ai-router modules.

    Returns resolved oracle-2 root (parent of `services/`).

    Raises SystemExit(1) if services/shared is missing.
    """
    env_root = (os.environ.get("MANTHANA_ROOT") or "").strip()
    if env_root:
        repo_root = Path(env_root).resolve()
    else:
        # oracle-service/paths_bootstrap.py -> parent is oracle-service; parents[1] == oracle-2
        here = Path(__file__).resolve().parent
        repo_root = here.parents[1]

    shared = repo_root / "services" / "shared"
    if not shared.is_dir():
        sys.stderr.write(
            f"FATAL: Manthana Oracle cannot find services/shared.\n"
            f"  Expected: {shared}\n"
            f"  Set MANTHANA_ROOT to your oracle-2 directory (contains services/shared/), "
            f"or run from a full checkout.\n"
        )
        raise SystemExit(1)

    rr = str(repo_root)
    if rr not in sys.path:
        sys.path.insert(0, rr)

    lib_docker = Path("/app/lib")
    ai_router = repo_root / "services" / "ai-router"
    if lib_docker.is_dir():
        lp = str(lib_docker)
        if lp not in sys.path:
            sys.path.insert(0, lp)
    elif ai_router.is_dir():
        ar = str(ai_router)
        if ar not in sys.path:
            sys.path.insert(0, ar)

    return repo_root
