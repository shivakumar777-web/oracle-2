"""Oracle Service Routers."""

from routers.chat import create_chat_router
from routers.m5 import create_m5_router
from routers.health import create_health_router

__all__ = ["create_chat_router", "create_m5_router", "create_health_router"]
