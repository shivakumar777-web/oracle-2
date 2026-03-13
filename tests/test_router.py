async def test_router_health(client_router):
    resp = await client_router.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert "services" in data["data"]

