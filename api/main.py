# api/main.py
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from google import genai

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
log = logging.getLogger("trading")

@asynccontextmanager
async def lifespan(_app: FastAPI):
    # pytest imports the app and calls /health; do not embed the corpus in CI
    if os.getenv("PYTEST_CURRENT_TEST"):
        yield
        return
    try:
        from rag import load_bucket
        log.info("indexed %s document(s)", load_bucket())
    except Exception:
        log.exception("document index was not loaded")
    yield

app = FastAPI(title="Trading Desk Assistant", version="1.0", lifespan=lifespan)
client = genai.Client(vertexai=True, project=os.environ["GOOGLE_CLOUD_PROJECT"], location="global")
MODEL = os.getenv("MODEL", "gemini-3.5-flash")  # check exact ID in the model list

class AskIn(BaseModel):
    question: str

class AskOut(BaseModel):
    answer: str
    sources: list[str] = []

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/v1/ask", response_model=AskOut)
def ask(body: AskIn):
    if not body.question.strip():
        raise HTTPException(422, "empty question")
    from rag import retrieve
    chunks = retrieve(body.question, k=4)
    context = "\n\n".join(f"[{c['source']}] {c['text']}" for c in chunks)
    prompt = ("Answer only from the context. Cite sources in brackets. "
              "If the answer is not in the context, say you don't know.\n\n"
              f"Context:\n{context}\n\nQuestion: {body.question}")
    resp = client.models.generate_content(model=MODEL, contents=prompt)
    return AskOut(answer=resp.text, sources=sorted({c["source"] for c in chunks}))
