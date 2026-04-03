"""Research Service Routers."""

from routers.research import create_research_router
from routers.plagiarism import create_plagiarism_router
from routers.health import create_health_router

__all__ = ["create_research_router", "create_plagiarism_router", "create_health_router"]
