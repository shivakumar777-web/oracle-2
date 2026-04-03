"""
Better Auth JWT validation for ai-router.
Validates Bearer tokens from the frontend (Better Auth JWT plugin).
"""
from __future__ import annotations

import logging
from typing import Optional

import jwt
from fastapi import Depends, HTTPException, Request
from jwt import PyJWKClient

from services.shared.config import Settings, get_settings

log = logging.getLogger("manthana.auth")

# JWKS client cache (lazy init)
_jwks_client: Optional[PyJWKClient] = None


def _get_jwks_client(settings: Settings) -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        jwks_url = f"{settings.BETTER_AUTH_URL.rstrip('/')}/api/auth/jwks"
        _jwks_client = PyJWKClient(jwks_url, cache_keys=True)
    return _jwks_client


def _extract_bearer_token(request: Request) -> Optional[str]:
    auth = request.headers.get("Authorization")
    if not auth or not auth.lower().startswith("bearer "):
        return None
    return auth[7:].strip()


async def get_current_user_optional(
    request: Request,
    settings: Settings = Depends(get_settings),
) -> Optional[dict]:
    """
    Validate JWT if present. Returns user payload or None.
    Use for routes that benefit from user context but don't require auth.
    """
    token = _extract_bearer_token(request)
    if not token:
        return None
    try:
        client = _get_jwks_client(settings)
        signing_key = client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["EdDSA"],
            issuer=settings.BETTER_AUTH_URL.rstrip("/"),
            audience=settings.BETTER_AUTH_URL.rstrip("/"),
        )
        return payload
    except jwt.ExpiredSignatureError:
        log.debug("JWT expired")
        return None
    except jwt.InvalidTokenError as e:
        log.debug("Invalid JWT: %s", e)
        return None


async def get_current_user(
    request: Request,
    settings: Settings = Depends(get_settings),
) -> dict:
    """
    Validate JWT. Returns user payload or raises 401.
    Use for protected routes that require authentication.
    """
    user = await get_current_user_optional(request, settings)
    if user is None:
        raise HTTPException(
            status_code=401,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


async def get_protected_user(
    request: Request,
    settings: Settings = Depends(get_settings),
):
    """
    When REQUIRE_AUTH=true: require JWT (401 if missing).
    When REQUIRE_AUTH=false: optional auth (return None if not signed in).
    Use on protected routes for phased rollout (MVP → production).
    """
    if settings.REQUIRE_AUTH:
        return await get_current_user(request, settings)
    return await get_current_user_optional(request, settings)
