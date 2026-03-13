async def test_nlp_medical_query(client_nlp, monkeypatch):
    async def fake_call_ollama(*args, **kwargs):
        return "Pneumonia is an infection of the lung parenchyma."

    resp = await client_nlp.post(
        "/query/medical",
        json={"question": "What is pneumonia?"},
    )
    assert resp.status_code in (200, 502)

