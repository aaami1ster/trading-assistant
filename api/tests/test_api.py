# api/tests/test_api.py
from fastapi.testclient import TestClient
from main import app

def test_health():
    assert TestClient(app).get("/health").json() == {"status": "ok"}

def test_agent_rejects_blank_question():
    response = TestClient(app).post("/v1/agent", json={"question": "   "})
    assert response.status_code == 422
