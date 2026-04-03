"""
base_search.py — BASE (Bielefeld Academic Search Engine) stub
=============================================================
Public HTTP API access often requires registration. Reserved for future wiring.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Tuple

logger = logging.getLogger("manthana.web.base_search")


async def search_base_works(
    query: str,
    page: int = 1,
    per_page: int = 10,
    timeout: float = 10.0,
    api_key: str | None = None,
) -> Tuple[List[Dict[str, Any]], int]:
    """
    Placeholder for BASE Search API integration.
    Returns empty until BASE API credentials / endpoint are configured.
    """
    _ = (query, page, per_page, timeout, api_key)
    logger.debug("BASE search stub — no results (configure API to enable)")
    return [], 0
