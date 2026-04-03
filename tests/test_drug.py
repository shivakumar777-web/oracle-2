import pytest


@pytest.mark.integration
async def test_drug_smiles_analysis(client_drug):
    body = {"smiles": "CC(=O)NC1=CC=C(O)C=C1"}
    resp = await client_drug.post("/analyze/smiles", json=body)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    props = data["data"]["properties"]
    assert "mw" in props and "logp" in props

