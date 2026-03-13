import io

from PIL import Image


async def test_radiology_analyze_xray(client_radiology):
    img = Image.new("L", (224, 224), color=128)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)

    files = {"file": ("test_xray.png", buf, "image/png")}
    resp = await client_radiology.post("/analyze/xray", files=files)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert "pathologies" in data["data"]

