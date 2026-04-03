import io

import numpy as np
import pandas as pd
import pytest


@pytest.mark.integration
async def test_ecg_analyze_csv(client_ecg):
    t = np.linspace(0, 10, 5000)
    signal = 0.5 * np.sin(2 * np.pi * 1.2 * t)
    df = pd.DataFrame({"time": t, "voltage": signal})
    buf = io.StringIO()
    df.to_csv(buf, index=False)
    buf.seek(0)
    files = {"file": ("sample_ecg.csv", buf.getvalue(), "text/csv")}
    resp = await client_ecg.post("/analyze/ecg", files=files)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert "report" in data["data"]

