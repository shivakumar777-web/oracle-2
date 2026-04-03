"""Web Service Routers."""

from routers.search import create_search_router
from routers.autocomplete import create_autocomplete_router
from routers.health import create_health_router

__all__ = ["create_search_router", "create_autocomplete_router", "create_health_router"]
