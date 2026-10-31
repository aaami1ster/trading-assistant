# api/main.py
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from google import genai

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

app = FastAPI(title="Trading Desk Assistant", version="1.0")
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
