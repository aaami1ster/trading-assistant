# api/agent.py
from google.genai import types
from main import client, MODEL

PRICES = {"brent": 82.4, "wti": 78.1, "dubai": 80.9}  # fake data for demo

def get_price(benchmark: str) -> dict:
    """Return the latest price in USD/bbl for a crude benchmark (brent, wti, dubai)."""
    return {"benchmark": benchmark, "usd_per_bbl": PRICES.get(benchmark.lower())}

def calc_exposure(volume_bbl: float, price: float) -> dict:
    """Return USD exposure for a volume in barrels at a price."""
    return {"usd": volume_bbl * price}

def run_agent(question: str) -> str:
    resp = client.models.generate_content(
        model=MODEL, contents=question,
        config=types.GenerateContentConfig(tools=[get_price, calc_exposure]),
    )  # the SDK runs the functions automatically and loops
    return resp.text
