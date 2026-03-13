import asyncio

import pytest
from httpx import AsyncClient

from services.ai-router.main import app as router_app
from services.radiology.main import app as radiology_app
from services.ecg.main import app as ecg_app
from services.nlp.main import app as nlp_app
from services.ayurveda.main import app as ayurveda_app
from services.drug.main import app as drug_app


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def client_router():
    async with AsyncClient(app=router_app, base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def client_radiology():
    async with AsyncClient(app=radiology_app, base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def client_ecg():
    async with AsyncClient(app=ecg_app, base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def client_nlp(monkeypatch):
    async with AsyncClient(app=nlp_app, base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def client_ayurveda():
    async with AsyncClient(app=ayurveda_app, base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def client_drug():
    async with AsyncClient(app=drug_app, base_url="http://test") as ac:
        yield ac

