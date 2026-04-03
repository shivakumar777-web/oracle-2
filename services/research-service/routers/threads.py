"""
threads.py — Research thread CRUD (Phase 3 persistence).
======================================================
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_protected_user
from config import ResearchSettings, get_research_settings
from db.models import ResearchThread
from db.session import get_session_factory

logger = logging.getLogger("manthana.research.threads")


class ThreadCreate(BaseModel):
    title: str = Field(default="", max_length=512)
    query: str = Field(..., max_length=4000)
    settings: Dict[str, Any] = Field(default_factory=dict)
    result: Optional[Dict[str, Any]] = None


class ThreadPatch(BaseModel):
    title: Optional[str] = Field(None, max_length=512)
    settings: Optional[Dict[str, Any]] = None
    result: Optional[Dict[str, Any]] = None


class ThreadOut(BaseModel):
    id: str
    user_sub: Optional[str]
    title: str
    query: str
    settings: Dict[str, Any]
    result: Optional[Dict[str, Any]]
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


def _user_sub(user: Optional[dict]) -> Optional[str]:
    if not user:
        return None
    return str(user.get("sub") or user.get("id") or "") or None


async def get_db_session(request: Request):
    factory = getattr(request.app.state, "db_session_factory", None)
    if factory is None:
        raise HTTPException(status_code=503, detail="Database not configured")
    async with factory() as session:
        yield session


def create_threads_router(limiter) -> APIRouter:
    router = APIRouter(tags=["research-threads"])

    @router.get("/research/threads")
    @limiter.limit("120/minute")
    async def list_threads(
        request: Request,
        limit: int = 50,
        settings: ResearchSettings = Depends(get_research_settings),
        user: Optional[dict] = Depends(get_protected_user),
        session: AsyncSession = Depends(get_db_session),
    ):
        """List threads for the current user (JWT sub). Anonymous users get an empty list."""
        sub = _user_sub(user)
        if sub is None:
            return JSONResponse(
                status_code=200,
                content={
                    "status": "success",
                    "service": "research",
                    "data": {"threads": []},
                    "request_id": getattr(request.state, "request_id", ""),
                },
            )
        q = (
            select(ResearchThread)
            .where(ResearchThread.user_sub == sub)
            .order_by(ResearchThread.updated_at.desc())
            .limit(min(limit, 100))
        )
        res = await session.execute(q)
        rows = res.scalars().all()
        out = [_thread_to_out(r) for r in rows]
        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "service": "research",
                "data": {"threads": out},
                "request_id": getattr(request.state, "request_id", ""),
            },
        )

    @router.post("/research/threads")
    @limiter.limit("60/minute")
    async def create_thread(
        request: Request,
        body: ThreadCreate,
        settings: ResearchSettings = Depends(get_research_settings),
        user: Optional[dict] = Depends(get_protected_user),
        session: AsyncSession = Depends(get_db_session),
    ):
        sub = _user_sub(user)
        title = body.title.strip() or body.query.strip()[:120]
        row = ResearchThread(
            user_sub=sub,
            title=title,
            query_text=body.query.strip()[:4000],
            settings_json=body.settings or {},
            result_json=body.result,
        )
        session.add(row)
        await session.commit()
        await session.refresh(row)
        return JSONResponse(
            status_code=201,
            content={
                "status": "success",
                "service": "research",
                "data": _thread_to_out(row),
                "request_id": getattr(request.state, "request_id", ""),
            },
        )

    @router.get("/research/threads/{thread_id}")
    @limiter.limit("120/minute")
    async def get_thread(
        request: Request,
        thread_id: str,
        settings: ResearchSettings = Depends(get_research_settings),
        user: Optional[dict] = Depends(get_protected_user),
        session: AsyncSession = Depends(get_db_session),
    ):
        sub = _user_sub(user)
        try:
            tid = uuid.UUID(thread_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid thread id")
        row = await session.get(ResearchThread, tid)
        if not row:
            raise HTTPException(status_code=404, detail="Not found")
        if sub and row.user_sub and row.user_sub != sub:
            raise HTTPException(status_code=403, detail="Forbidden")
        if sub is None and row.user_sub is not None:
            raise HTTPException(status_code=403, detail="Forbidden")
        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "service": "research",
                "data": _thread_to_out(row),
                "request_id": getattr(request.state, "request_id", ""),
            },
        )

    @router.patch("/research/threads/{thread_id}")
    @limiter.limit("60/minute")
    async def patch_thread(
        request: Request,
        thread_id: str,
        body: ThreadPatch,
        settings: ResearchSettings = Depends(get_research_settings),
        user: Optional[dict] = Depends(get_protected_user),
        session: AsyncSession = Depends(get_db_session),
    ):
        sub = _user_sub(user)
        try:
            tid = uuid.UUID(thread_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid thread id")
        row = await session.get(ResearchThread, tid)
        if not row:
            raise HTTPException(status_code=404, detail="Not found")
        if sub and row.user_sub and row.user_sub != sub:
            raise HTTPException(status_code=403, detail="Forbidden")
        if sub is None and row.user_sub is not None:
            raise HTTPException(status_code=403, detail="Forbidden")

        if body.title is not None:
            row.title = body.title[:512]
        if body.settings is not None:
            row.settings_json = body.settings
        if body.result is not None:
            row.result_json = body.result
        row.updated_at = datetime.now(timezone.utc)
        await session.commit()
        await session.refresh(row)
        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "service": "research",
                "data": _thread_to_out(row),
                "request_id": getattr(request.state, "request_id", ""),
            },
        )

    @router.delete("/research/threads/{thread_id}")
    @limiter.limit("60/minute")
    async def delete_thread(
        request: Request,
        thread_id: str,
        settings: ResearchSettings = Depends(get_research_settings),
        user: Optional[dict] = Depends(get_protected_user),
        session: AsyncSession = Depends(get_db_session),
    ):
        sub = _user_sub(user)
        try:
            tid = uuid.UUID(thread_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid thread id")
        row = await session.get(ResearchThread, tid)
        if not row:
            raise HTTPException(status_code=404, detail="Not found")
        if sub and row.user_sub and row.user_sub != sub:
            raise HTTPException(status_code=403, detail="Forbidden")
        if sub is None and row.user_sub is not None:
            raise HTTPException(status_code=403, detail="Forbidden")
        await session.delete(row)
        await session.commit()
        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "service": "research",
                "data": {"deleted": True, "id": thread_id},
                "request_id": getattr(request.state, "request_id", ""),
            },
        )

    return router


def _thread_to_out(row: ResearchThread) -> Dict[str, Any]:
    return {
        "id": str(row.id),
        "user_sub": row.user_sub,
        "title": row.title,
        "query": row.query_text,
        "settings": row.settings_json or {},
        "result": row.result_json,
        "created_at": row.created_at.isoformat() if row.created_at else "",
        "updated_at": row.updated_at.isoformat() if row.updated_at else "",
    }
