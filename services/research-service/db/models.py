"""SQLAlchemy models for research threads."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base


class ResearchThread(Base):
    """Saved deep-research session (query + settings + optional result snapshot)."""

    __tablename__ = "research_threads"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_sub: Mapped[Optional[str]] = mapped_column(String(256), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(512), default="")
    query_text: Mapped[str] = mapped_column(Text, default="")
    settings_json: Mapped[Dict[str, Any]] = mapped_column(JSONB, default=dict)
    result_json: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
