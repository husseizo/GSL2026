"""DGX AI Platform inference boundary.

This service is the ONLY thing in the whole Automotive Intelligence Operating
System that talks to a model runtime (Ollama today; the same code talks to
Ollama running on an actual DGX Spark later — Ollama auto-detects CUDA and
GPU-accelerates transparently, no code change required to "upgrade").

Structural guarantee, not just a convention: this process has no database
driver, no ORM, no connection string anywhere in its dependency tree. It
cannot write to a transactional table even by mistake, because it has no way
to reach one. It receives text, returns text/vectors/health, and logs
nothing to permanent storage itself — the NestJS AI Gateway is what logs
every inference to AiInferenceLog. See docs/architecture/dgx-platform.md and
docs/architecture/security-dgx.md.
"""

from __future__ import annotations

import os
import subprocess
import time
from typing import Optional

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
DEFAULT_GENERATION_MODEL = os.environ.get("DEFAULT_GENERATION_MODEL", "llama3")
DEFAULT_EMBEDDING_MODEL = os.environ.get("DEFAULT_EMBEDDING_MODEL", "nomic-embed-text")
SERVICE_VERSION = "0.1.0"

MAX_PROMPT_CHARS = 20_000

app = FastAPI(title="DGX AI Platform", version=SERVICE_VERSION)


class GenerateRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=MAX_PROMPT_CHARS)
    system: Optional[str] = Field(default=None, max_length=MAX_PROMPT_CHARS)
    model: Optional[str] = None
    temperature: float = 0.2
    maxTokens: Optional[int] = None
    # Additive, backward-compatible: unset by default (identical behavior to
    # before). When set to "json", passed straight through to Ollama's own
    # `format` option, which constrains decoding to produce valid JSON —
    # used by the Catalogue RAG structured-answer schema (DGX Prototype
    # 1.5) to reduce structured-output repair/failure rate. See
    # docs/ai-tuning/claim-verification.md.
    format: Optional[str] = None


class GenerateResponse(BaseModel):
    text: str
    model: str
    tokensIn: int
    tokensOut: int
    latencyMs: int


class EmbedRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=MAX_PROMPT_CHARS)
    model: Optional[str] = None


class EmbedResponse(BaseModel):
    embedding: list[float]
    model: str
    dims: int
    latencyMs: int


class ModelInfo(BaseModel):
    name: str
    sizeBytes: int
    modifiedAt: Optional[str] = None
    digest: Optional[str] = None


class GpuInfo(BaseModel):
    name: str
    memoryTotalMiB: Optional[int] = None
    memoryUsedMiB: Optional[int] = None
    utilizationPct: Optional[int] = None


class HealthResponse(BaseModel):
    status: str
    version: str
    mode: str
    gpuAvailable: bool
    gpuDevices: list[GpuInfo]
    ollamaReachable: bool
    ollamaVersion: Optional[str] = None


def _detect_gpu() -> tuple[bool, list[GpuInfo]]:
    """Honest GPU detection. Returns (False, []) on this CPU-only sandbox;
    returns real device info when actually run on a machine with nvidia-smi
    (i.e. a real DGX Spark) — same code, different environment, no fabrication
    either way."""
    try:
        result = subprocess.run(
            [
                "nvidia-smi",
                "--query-gpu=name,memory.total,memory.used,utilization.gpu",
                "--format=csv,noheader,nounits",
            ],
            capture_output=True,
            text=True,
            timeout=5,
        )
    except (FileNotFoundError, subprocess.SubprocessError):
        return False, []

    if result.returncode != 0 or not result.stdout.strip():
        return False, []

    devices: list[GpuInfo] = []
    for line in result.stdout.strip().splitlines():
        parts = [p.strip() for p in line.split(",")]
        if len(parts) != 4:
            continue
        name, mem_total, mem_used, util = parts
        devices.append(
            GpuInfo(
                name=name,
                memoryTotalMiB=int(mem_total) if mem_total.isdigit() else None,
                memoryUsedMiB=int(mem_used) if mem_used.isdigit() else None,
                utilizationPct=int(util) if util.isdigit() else None,
            )
        )
    return len(devices) > 0, devices


@app.get("/v1/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    gpu_available, gpu_devices = _detect_gpu()

    ollama_reachable = False
    ollama_version = None
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(f"{OLLAMA_BASE_URL}/api/version")
            if resp.status_code == 200:
                ollama_reachable = True
                ollama_version = resp.json().get("version")
    except httpx.HTTPError:
        pass

    return HealthResponse(
        status="ok" if ollama_reachable else "degraded",
        version=SERVICE_VERSION,
        mode="gpu" if gpu_available else "cpu",
        gpuAvailable=gpu_available,
        gpuDevices=gpu_devices,
        ollamaReachable=ollama_reachable,
        ollamaVersion=ollama_version,
    )


@app.get("/v1/models", response_model=list[ModelInfo])
async def list_models() -> list[ModelInfo]:
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
            resp.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail=f"Ollama unreachable: {exc}") from exc

    models = resp.json().get("models", [])
    return [
        ModelInfo(
            name=m["name"],
            sizeBytes=m.get("size", 0),
            modifiedAt=m.get("modified_at"),
            digest=m.get("digest"),
        )
        for m in models
    ]


@app.post("/v1/generate", response_model=GenerateResponse)
async def generate(req: GenerateRequest) -> GenerateResponse:
    model = req.model or DEFAULT_GENERATION_MODEL
    started = time.monotonic()

    payload = {
        "model": model,
        "prompt": req.prompt,
        "system": req.system,
        "stream": False,
        "options": {"temperature": req.temperature},
    }
    if req.maxTokens:
        payload["options"]["num_predict"] = req.maxTokens
    if req.format:
        payload["format"] = req.format

    try:
        async with httpx.AsyncClient(timeout=180) as client:
            resp = await client.post(f"{OLLAMA_BASE_URL}/api/generate", json=payload)
            resp.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail=f"Ollama unreachable or model not loaded: {exc}") from exc

    body = resp.json()
    latency_ms = int((time.monotonic() - started) * 1000)

    return GenerateResponse(
        text=body.get("response", ""),
        model=model,
        tokensIn=body.get("prompt_eval_count", 0),
        tokensOut=body.get("eval_count", 0),
        latencyMs=latency_ms,
    )


@app.post("/v1/embed", response_model=EmbedResponse)
async def embed(req: EmbedRequest) -> EmbedResponse:
    model = req.model or DEFAULT_EMBEDDING_MODEL
    started = time.monotonic()

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{OLLAMA_BASE_URL}/api/embeddings", json={"model": model, "prompt": req.text}
            )
            resp.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail=f"Ollama unreachable or model not loaded: {exc}") from exc

    body = resp.json()
    embedding = body.get("embedding", [])
    latency_ms = int((time.monotonic() - started) * 1000)

    return EmbedResponse(embedding=embedding, model=model, dims=len(embedding), latencyMs=latency_ms)
