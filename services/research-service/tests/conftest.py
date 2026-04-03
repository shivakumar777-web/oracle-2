"""Pytest path bootstrap for research-service."""

from __future__ import annotations

import sys
from pathlib import Path

_RS = Path(__file__).resolve().parent.parent
_REPO = _RS.parent.parent
for p in (_RS, _REPO):
    if str(p) not in sys.path:
        sys.path.insert(0, str(p))
