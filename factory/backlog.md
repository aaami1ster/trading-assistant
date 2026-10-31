# Backlog

`/factory next` runs the first unchecked item.

- [x] Make `get_price` return an explicit error for a benchmark other than brent, wti, or dubai, instead of a null price the model might guess around
- [ ] Rate limit `/v1/ask` and `/v1/agent` per client IP, since the API is public and every request spends Gemini quota
- [ ] Add unit tests for `chunk` in `api/rag.py`, covering the overlap and text shorter than one chunk
