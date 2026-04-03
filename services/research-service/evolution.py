"""
Self-evolving memory — append-only JSONL lessons for domain/intent patterns.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

logger = logging.getLogger("manthana.research.evolution")

LESSONS_PATH = Path(
    os.getenv("RESEARCH_LESSONS_PATH", "/opt/manthana/data/research_lessons.jsonl")
)


def record_lesson(
    domains: List[str],
    intent: str,
    query_pattern: str,
    outcome: str,
    connector_stats: Dict[str, Any],
    notes: str = "",
) -> None:
    try:
        LESSONS_PATH.parent.mkdir(parents=True, exist_ok=True)
        lesson = {
            "ts": datetime.utcnow().isoformat(),
            "domains": domains,
            "intent": intent,
            "query_pattern": query_pattern[:200],
            "outcome": outcome,
            "connector_stats": connector_stats,
            "notes": notes,
        }
        with LESSONS_PATH.open("a", encoding="utf-8") as f:
            f.write(json.dumps(lesson, ensure_ascii=False) + "\n")
    except Exception as e:
        logger.debug("record_lesson_skip: %s", e)


def load_lessons(domains: List[str], intent: str, limit: int = 5) -> List[Dict[str, Any]]:
    if not LESSONS_PATH.exists():
        return []
    try:
        lines = LESSONS_PATH.read_text(encoding="utf-8").splitlines()[-200:]
        lessons = [json.loads(l) for l in lines if l.strip()]
        dom_set = set(domains)
        matched = [
            l
            for l in lessons
            if set(l.get("domains", [])) & dom_set and l.get("intent") == intent
        ]
        return matched[-limit:]
    except Exception:
        return []


def format_lessons_for_prompt(lessons: List[Dict[str, Any]]) -> str:
    if not lessons:
        return ""
    lines: List[str] = ["Past research insights for these domains:"]
    for l in lessons:
        if l.get("outcome") in ("degraded", "no_results"):
            doms = l.get("domains") or []
            lines.append(
                f"- Note: {l.get('notes') or 'Low results for ' + ','.join(str(x) for x in doms)}"
            )
        elif l.get("outcome") == "good":
            top_connectors = sorted(
                (l.get("connector_stats") or {}).items(),
                key=lambda x: x[1],
                reverse=True,
            )[:2]
            if top_connectors:
                lines.append(
                    f"- Best sources for {','.join(str(x) for x in (l.get('domains') or []))}: "
                    f"{', '.join(str(c) for c, _ in top_connectors)}"
                )
    return "\n".join(lines) if len(lines) > 1 else ""


def read_recent_lessons(max_lines: int = 50) -> List[Dict[str, Any]]:
    if not LESSONS_PATH.exists():
        return []
    try:
        lines = LESSONS_PATH.read_text(encoding="utf-8").splitlines()[-max_lines:]
        return [json.loads(l) for l in lines if l.strip()]
    except Exception:
        return []
