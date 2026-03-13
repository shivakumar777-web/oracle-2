async def test_ayurveda_prakriti(client_ayurveda):
    body = {
        "attributes": {
            "body_frame": "slim",
            "appetite": "variable",
            "sleep_quality": "light",
            "temperature_tolerance": "cold_intolerant",
        }
    }
    resp = await client_ayurveda.post("/analyze/prakriti", json=body)
    assert resp.status_code == 200
    data = resp.json()
    scores = data["data"]
    total = scores["vata"] + scores["pitta"] + scores["kapha"]
    assert 99.0 <= total <= 101.0

