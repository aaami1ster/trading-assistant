# Trading Desk Assistant — check against the weekend brief

Source: `docs/Weekend Interview Prep — Senior SWE, AI & Cloud (GCP).pdf`, pages 11–18, “Hands-on project: Trading Desk Assistant” (31 Oct 2026). The Claude artifact link is the same brief. This file is the gap check of the repo and of project `trading-assistant-abdalla` against those eight steps.

Definition of done in the brief: a FastAPI + React app on Cloud Run that answers from trading documents (RAG) and calls tools (agent), deployed by Cloud Build on every Git push. In the interview, show the HTTPS URL and the repo.

## Status

| Step | Brief | Repo / GCP now |
| --- | --- | --- |
| 1. Setup | Project, APIs, Artifact Registry `apps` in `me-central2` | Project exists. APIs are enabled. Testing region is **`me-central1`** (Doha): this account cannot create resources in `me-central2`. Docker repo `apps` is already there. |
| 2. FastAPI | `main.py`, health test, slim Dockerfile, `requirements.txt` | `main.py` and `tests/test_api.py` match the brief, plus dotenv loading. Packaging is uv (`pyproject.toml`, `uv.lock`). The image is `ghcr.io/astral-sh/uv`, still non-root, and still uses `$PORT`. |
| 3. Cloud Run | Service account `rag-api-sa`, `roles/aiplatform.user`, `gcloud run deploy rag-api` | Not deployed. The only service account is the default compute account. No Cloud Run service. |
| 4. CI/CD | `cloudbuild.yaml`: test → build → push → deploy. Trigger on `main`. Second trigger for `rag-api-dev`. | `cloudbuild.yaml` is an empty file. No triggers. |
| 5. React | One chat page: question, answer, sources. CORS. Second Cloud Run service or static files. | `web/` is the Vite starter. No ask UI, no CORS, not deployed. |
| 6. RAG | `rag.py` as written, plus load 3–5 docs from the bucket at startup | `rag.py` matches the snippet. Nothing calls `add_document`. No docs, no bucket, no startup load. `google-cloud-storage` is a dependency and is unused. |
| 7. Agent | `agent.py` as written, exposed as `POST /v1/agent` | `agent.py` matches. No route. ADK is a stretch and is not started. |
| 8. Terraform | `infra/main.tf` as written; `terraform plan` is enough | Same resources as the snippet. Region is `me-central1` for this account. `var.project` and `var.image` are undeclared, so `terraform plan` fails. Not applied. |
| README | How to run, architecture, decisions | `README.md` is empty. |

Code that already matches the brief and should stay: the `/health` and `/v1/ask` handlers, the chunk/embed/retrieve functions, and the two tools (`get_price`, `calc_exposure`) with the demo prices.

## What is still missing, in weekend order

Do these in order if time is short. The brief’s minimum weekend is steps 2, 3, 4, and 6 (backend, Cloud Run, CI/CD, RAG). The React page and the agent route are what make the demo match the 60-second script.

1. **Test in `me-central1`.** Creating `apps` in `me-central2` returned `LOCATION_POLICY_VIOLATED` for this account. The Docker repo `apps` stays in Doha. Terraform, Cloud Run, and the bucket use `me-central1` to match it. In the interview, Dammam (`me-central2`) is still the data-residency answer; say this account could not open that region, so the demo runs in `me-central1`.
2. **Test in Cloud Build with uv.** From `api/`: `uv run --frozen pytest -q`. That uses `uv.lock` and the dev group (`pytest`, `httpx`). The image tag for this account is `me-central1-docker.pkg.dev/${PROJECT_ID}/apps/rag-api:${SHORT_SHA}`.
3. **Create `rag-api-sa` and grant `roles/aiplatform.user`.** Then deploy:

```bash
PROJECT=trading-assistant-abdalla
gcloud iam service-accounts create rag-api-sa --project "$PROJECT"
gcloud projects add-iam-policy-binding "$PROJECT" \
  --member="serviceAccount:rag-api-sa@${PROJECT}.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"
gcloud run deploy rag-api --source api --region me-central1 \
  --service-account "rag-api-sa@${PROJECT}.iam.gserviceaccount.com" \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=${PROJECT}" \
  --allow-unauthenticated
```

`--source api` builds with Cloud Build from the Dockerfile. The uv image is fine for that path. After it is up: `gcloud run services describe`, read Cloud Logging, split traffic 90/10, and roll back. That practice is part of step 3.

4. **Fill `cloudbuild.yaml` and connect a trigger on `main`.** Grant the Cloud Build service account `roles/run.admin` and `roles/iam.serviceAccountUser`. Add a second trigger on a `dev` branch that deploys `rag-api-dev`.
5. **Load documents at startup.** Bucket name from Terraform is `trading-assistant-abdalla-docs` in `ME-CENTRAL1`. Put 3–5 text files in it (a commodity glossary, an Incoterms summary, a made-up desk policy). On FastAPI startup, list the bucket with `google-cloud-storage` and call `add_document`. Until that exists, `/v1/ask` retrieves from an empty list and the model is told to say it does not know.
6. **Add `POST /v1/agent`.** Body `{ "question": string }`, call `run_agent`, return the text. Check with: “What is our USD exposure on a 500,000 barrel Brent cargo?” The model should call `get_price` then `calc_exposure`.
7. **Replace the Vite starter with one page:** textarea, Ask button, answer, and the source list. `fetch(API_URL + "/v1/ask")`. Add CORS for that origin. Deploy the built site as a second Cloud Run service or as static files from FastAPI.
8. **Declare Terraform variables and run `terraform plan`.** `project` and `image`. The brief does not require apply. Explain plan, apply, and remote state in a GCS bucket. Put each attribute on its own line.
9. **Write `README.md`.** How to run, the architecture (CI/CD path and request path), and the decisions below.

Secret Manager is enabled and the Saturday schedule says to use it. The written deploy command only sets `GOOGLE_CLOUD_PROJECT` as an env var. Use Secret Manager if you put a credential there. The Vertex client on Cloud Run should keep using the service account, not a key.

## Run locally

From the repo root, `.env` already has:

```bash
GOOGLE_CLOUD_PROJECT=trading-assistant-abdalla
MODEL=gemini-3.5-flash
```

Confirm `MODEL` in the Vertex model list before the interview. The brief’s default is `gemini-3.5-flash`. Auth:

```bash
gcloud auth login && gcloud auth application-default login
gcloud config set project trading-assistant-abdalla
```

API (uv, which this repo uses):

```bash
cd api
uv sync
uv run uvicorn main:app --reload --host 127.0.0.1 --port 8080
curl -s http://127.0.0.1:8080/health
uv run pytest
```

`/v1/ask` needs documents in the process that is serving. A one-off `add_document` in another Python process does not fill the uvicorn process. Startup loading is the step 6 fix.

Agent, still in-process until the route exists:

```bash
cd api
uv run python -c 'from agent import run_agent; print(run_agent("What is our USD exposure on a 500,000 barrel Brent cargo?"))'
```

Web, starter only:

```bash
cd web && npm install && npm run dev
```

Container, from `api/`:

```bash
docker build -t rag-api .
docker run --rm -p 8080:8080 \
  -e GOOGLE_CLOUD_PROJECT=trading-assistant-abdalla \
  -e MODEL=gemini-3.5-flash \
  -e GOOGLE_APPLICATION_CREDENTIALS=/tmp/adc.json \
  -v "$HOME/.config/gcloud/application_default_credentials.json:/tmp/adc.json:ro" \
  rag-api
```

Build with `--platform linux/amd64` when the image is the one Cloud Run will run.

## Deploy

Testing registry (this account):

`me-central1-docker.pkg.dev/trading-assistant-abdalla/apps/rag-api`

The `apps` repository is already in `me-central1`. Push there. The brief’s Dammam host, `me-central2-docker.pkg.dev/...`, stays closed until Google opens that region.

Cloud Build file to put in `cloudbuild.yaml`. The test step uses the same uv image as `api/Dockerfile`:

```yaml
substitutions:
  _REGION: me-central1
  _IMAGE: me-central1-docker.pkg.dev/${PROJECT_ID}/apps/rag-api
steps:
  - id: test
    name: ghcr.io/astral-sh/uv:python3.12-bookworm-slim
    dir: api
    entrypoint: uv
    args: ["run", "--frozen", "pytest", "-q"]
  - id: build
    name: gcr.io/cloud-builders/docker
    args: ["build", "-t", "${_IMAGE}:${SHORT_SHA}", "api"]
  - id: push
    name: gcr.io/cloud-builders/docker
    args: ["push", "${_IMAGE}:${SHORT_SHA}"]
  - id: deploy
    name: gcr.io/google.com/cloudsdktool/cloud-sdk
    entrypoint: gcloud
    args:
      ["run", "deploy", "rag-api", "--image", "${_IMAGE}:${SHORT_SHA}", "--region", "${_REGION}"]
images: ["${_IMAGE}:${SHORT_SHA}"]
```

The deploy step also needs the service account and `GOOGLE_CLOUD_PROJECT`, or a revision will start and crash on import. Pass `--service-account rag-api-sa@${PROJECT_ID}.iam.gserviceaccount.com` and `--set-env-vars GOOGLE_CLOUD_PROJECT=${PROJECT_ID}`.

Terraform stays a plan-only stretch. It does not replace the `gcloud run deploy` above until variables, the image, and IAM exist.

## Decisions to be able to say

These are the brief’s own follow-ups, not extra features.

- **Chunk size.** 800 characters with 150 overlap keeps a boundary sentence in two chunks. Larger chunks mean fewer, coarser hits. Smaller chunks mean more embedding calls and weaker context.
- **Cosine.** Vectors are divided by their length, so the dot product is cosine similarity. Rank by that and take four.
- **“Say you don’t know.”** The prompt forbids answers that are not in the retrieved text. That is the hallucination control for this demo.
- **Evals.** Ten questions with expected answers. Score whether the citation is a source that was actually retrieved.
- **Production store.** Say pgvector on AlloyDB, or Vertex AI Vector Search / RAG Engine. The in-memory list is per instance. Cloud Run scale of 3, or scale to zero, drops or splits the index.
- **Production controls, in one sentence.** IAP or SSO, pgvector or Vector Search, evals in the pipeline, Model Armor. The closing script in the brief is that sentence.
- **Agent risk.** Both tools are read-only calculations on fake prices. Say that a write tool would need a human confirm step.
- **Dockerfile talking points if you switch back to the brief’s image.** `USER 1000` so the process is not root, `$PORT` because Cloud Run injects it, slim base so cold start stays small. The uv image still does the first two. Be ready to say why packaging is uv.
