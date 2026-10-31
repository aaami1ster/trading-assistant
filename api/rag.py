# api/rag.py  (in-memory vector store: fine for a demo; say pgvector/AlloyDB for prod)
import os

import numpy as np
from main import client

INDEX: list[dict] = []  # {text, source, vec}
DOCS_BUCKET = os.getenv("DOCS_BUCKET", "trading-assistant-abdalla-docs")

def chunk(text: str, size=800, overlap=150):
    for i in range(0, len(text), size - overlap):
        yield text[i:i + size]

def embed(texts: list[str]) -> np.ndarray:
    r = client.models.embed_content(model="gemini-embedding-001", contents=texts)
    return np.array([e.values for e in r.embeddings])

def add_document(text: str, source: str):
    parts = list(chunk(text))
    for t, v in zip(parts, embed(parts)):
        INDEX.append({"text": t, "source": source, "vec": v / np.linalg.norm(v)})

def retrieve(q: str, k=4):
    qv = embed([q])[0]; qv /= np.linalg.norm(qv)
    scored = sorted(INDEX, key=lambda c: -float(c["vec"] @ qv))
    return scored[:k]

def load_bucket(bucket_name: str | None = None) -> int:
    """Replace INDEX with .txt and .md objects from the docs bucket."""
    from google.cloud import storage

    name = bucket_name or DOCS_BUCKET
    INDEX.clear()
    loaded = 0
    for blob in storage.Client().list_blobs(name):
        if blob.name.endswith("/") or not blob.name.lower().endswith((".txt", ".md")):
            continue
        text = blob.download_as_text(encoding="utf-8")
        if not text.strip():
            continue
        add_document(text, blob.name)
        loaded += 1
    return loaded
