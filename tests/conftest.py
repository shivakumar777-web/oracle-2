import asyncio
import importlib.util
import os
import sys

import pytest

# Ensure project root on path for services.shared imports
_project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)
from asgi_lifespan import LifespanManager
from httpx import ASGITransport, AsyncClient


def _load_router_app():
    """Lazy-load ai-router (dir has hyphen, use importlib)."""
    import sys
    _router_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "services", "ai-router"))
    if _router_dir not in sys.path:
        sys.path.insert(0, _router_dir)
    _router_path = os.path.join(_router_dir, "main.py")
    _spec = importlib.util.spec_from_file_location("ai_router_main", _router_path)
    _mod = importlib.util.module_from_spec(_spec)
    sys.modules["ai_router_main"] = _mod
    _spec.loader.exec_module(_mod)
    return _mod.app


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
def app_router():
    """AI router FastAPI app (for dependency_overrides in auth tests)."""
    return _load_router_app()


@pytest.fixture
async def client_router(app_router):
    app = app_router
    async with LifespanManager(app):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            yield ac


@pytest.fixture
async def client_ecg():
    from services.ecg.main import app as ecg_app
    async with AsyncClient(
        transport=ASGITransport(app=ecg_app), base_url="http://test"
    ) as ac:
        yield ac


@pytest.fixture
async def client_nlp(monkeypatch):
    from services.nlp.main import app as nlp_app
    async with AsyncClient(
        transport=ASGITransport(app=nlp_app), base_url="http://test"
    ) as ac:
        yield ac


@pytest.fixture
async def client_ayurveda():
    from services.ayurveda.main import app as ayurveda_app
    async with AsyncClient(
        transport=ASGITransport(app=ayurveda_app), base_url="http://test"
    ) as ac:
        yield ac


@pytest.fixture
async def client_drug():
    from services.drug.main import app as drug_app
    async with AsyncClient(
        transport=ASGITransport(app=drug_app), base_url="http://test"
    ) as ac:
        yield ac

