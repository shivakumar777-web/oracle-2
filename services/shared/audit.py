"""
Analysis audit trail for regulatory compliance.

Persists which model produced which finding for each request.
SQLite-backed; no PII in findings_summary (labels + confidence only).
"""

from __future__ import annotations

import json
import logging
import os
import sqlite3
from contextlib import contextmanager
from typing import Any, Dict, List, Optional

logger = logging.getLogger("manthana.audit")

_DEFAULT_DB_PATH = os.environ.get("AUDIT_DB_PATH", "manthana_audit.db")
_conn: Optional[sqlite3.Connection] = None
_conn_by_path: Dict[str, sqlite3.Connection] = {}


def _get_conn(db_path: Optional[str] = None) -> sqlite3.Connection:
    """Lazy-init SQLite connection. Supports multiple paths for testing."""
    global _conn
    path = (db_path or _DEFAULT_DB_PATH).replace("\\", "/")
    if db_path:
        if path not in _conn_by_path:
            c = sqlite3.connect(path, check_same_thread=False)
            c.row_factory = sqlite3.Row
            _init_schema(c)
            _conn_by_path[path] = c
        return _conn_by_path[path]
    if _conn is None:
        _conn = sqlite3.connect(path, check_same_thread=False)
        _conn.row_factory = sqlite3.Row
        _init_schema(_conn)
    return _conn


def _init_schema(conn: sqlite3.Connection) -> None:
    """Create analysis_audit table if not exists."""
    conn.execute("""
        CREATE TABLE IF NOT EXISTS analysis_audit (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            request_id TEXT NOT NULL,
            patient_id TEXT,
            study_id TEXT,
            service TEXT NOT NULL,
            model_id TEXT,
            endpoint TEXT NOT NULL,
            findings_summary TEXT,
            findings_count INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_audit_request_id ON analysis_audit(request_id)"
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_audit_patient_id ON analysis_audit(patient_id)"
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_audit_created_at ON analysis_audit(created_at)"
    )
    conn.commit()


def _findings_to_summary(findings: List[Dict[str, Any]]) -> str:
    """Build non-PII summary: labels + confidence only."""
    if not findings:
        return "No findings"
    parts = []
    for f in findings[:20]:  # cap at 20
        if isinstance(f, dict):
            label = f.get("label", f.get("name", ""))
            conf = f.get("confidence", f.get("score", 0))
            if isinstance(conf, float) and conf <= 1.0:
                conf = int(round(conf * 100))
            parts.append(f"{label}:{conf}%")
    return "; ".join(parts) if parts else "No findings"


def write_audit_log(
    request_id: str,
    service: str,
    endpoint: str,
    model_id: Optional[str] = None,
    patient_id: Optional[str] = None,
    study_id: Optional[str] = None,
    findings: Optional[List[Dict[str, Any]]] = None,
    findings_count: Optional[int] = None,
    db_path: Optional[str] = None,
) -> None:
    """
    Write an analysis audit log entry.

    Args:
        request_id: Unique request identifier
        service: Downstream service name (radiology, eye, cancer, etc.)
        endpoint: API endpoint called (e.g. /analyze/xray)
        model_id: Model identifier if known
        patient_id: Optional patient ID from request
        study_id: Optional study ID
        findings: List of {label, confidence} — only labels/confidence stored, no PII
        findings_count: Optional count if findings list not provided
        db_path: Override SQLite DB path
    """
    try:
        summary = _findings_to_summary(findings) if findings else ""
        count = findings_count if findings_count is not None else (len(findings) if findings else 0)
        conn = _get_conn(db_path)
        conn.execute(
            """
            INSERT INTO analysis_audit
            (request_id, patient_id, study_id, service, model_id, endpoint, findings_summary, findings_count)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                request_id or "",
                patient_id or None,
                study_id or None,
                service or "unknown",
                model_id or None,
                endpoint or "",
                summary[:2000],  # limit length
                count,
            ),
        )
        conn.commit()
    except Exception as exc:
        logger.warning("Audit log write failed: %s", exc)


def query_audit_log(
    request_id: Optional[str] = None,
    patient_id: Optional[str] = None,
    service: Optional[str] = None,
    limit: int = 100,
    db_path: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Query audit log entries (for compliance/debugging).

    Returns list of dicts with request_id, patient_id, service, model_id, endpoint, findings_summary, created_at.
    """
    try:
        conn = _get_conn(db_path)
        conditions = []
        params: List[Any] = []
        if request_id:
            conditions.append("request_id = ?")
            params.append(request_id)
        if patient_id:
            conditions.append("patient_id = ?")
            params.append(patient_id)
        if service:
            conditions.append("service = ?")
            params.append(service)
        where = " AND ".join(conditions) if conditions else "1=1"
        params.append(limit)
        rows = conn.execute(
            f"""
            SELECT request_id, patient_id, study_id, service, model_id, endpoint,
                   findings_summary, findings_count, created_at
            FROM analysis_audit
            WHERE {where}
            ORDER BY created_at DESC
            LIMIT ?
            """,
            params,
        ).fetchall()
        return [dict(r) for r in rows]
    except Exception as exc:
        logger.warning("Audit log query failed: %s", exc)
        return []
