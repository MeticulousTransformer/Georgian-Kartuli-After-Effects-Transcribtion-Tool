"""Kartuli Caption Forge — local backend.

Run:  python backend/app.py   (or: cd backend && python app.py)
Serves http://127.0.0.1:8765 for the After Effects panel.
"""
from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

VERSION = "0.1.0"
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
EXPORTS_DIR = os.path.join(os.path.dirname(BACKEND_DIR), "exports")


def load_env() -> None:
    """Load backend/.env (or backend/config.env). os.environ wins."""
    for name in (".env", "config.env"):
        path = os.path.join(BACKEND_DIR, name)
        if not os.path.isfile(path):
            continue
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                k, v = k.strip(), v.strip().strip('"').strip("'")
                if v and k not in os.environ:
                    os.environ[k] = v


load_env()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from services.audio_extract import extract_audio, find_ffmpeg, wav_duration
from services.grouping import GroupingOptions, group_words
from services.local_scan import scan_local
from services.models import build_document
from services.provider_registry import available_ids, get_provider, list_infos
from providers.base import ProviderError

app = FastAPI(title="Kartuli Caption Forge Backend", version=VERSION)
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)


class GroupingModel(BaseModel):
    maxWords: int = 4
    maxChars: int = 42
    pauseBreakSeconds: float = 0.55
    minCaptionDuration: float = 0.5
    maxCaptionDuration: float = 3.5


class ExtractRequest(BaseModel):
    mediaPath: str


class TranscribeRequest(BaseModel):
    mediaPath: str
    language: str = "ka-GE"
    provider: str = "elevenlabs"
    providerOptions: dict = Field(default_factory=dict)
    grouping: GroupingModel = Field(default_factory=GroupingModel)


def _save_json(path: str, data) -> str:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return path


@app.get("/health")
def health():
    return {
        "ok": True,
        "version": VERSION,
        "availableProviders": available_ids(),
        "ffmpeg": find_ffmpeg(),
    }


@app.get("/providers")
def providers():
    return {"providers": list_infos(), "local": scan_local()}


@app.post("/extract_audio")
def extract(req: ExtractRequest):
    try:
        wav = extract_audio(req.mediaPath, EXPORTS_DIR)
        return {"audio": wav, "duration": wav_duration(wav)}
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/transcribe")
def transcribe(req: TranscribeRequest):
    if not os.path.isfile(req.mediaPath):
        raise HTTPException(status_code=400, detail=f"Media file not found: {req.mediaPath}")

    provider = get_provider(req.provider)
    if provider is None:
        raise HTTPException(status_code=400, detail=f"Unknown provider: {req.provider}")
    ok, detail = provider.availability()
    if not ok:
        raise HTTPException(status_code=400, detail=f"Provider unavailable: {detail}.")

    try:
        wav = extract_audio(req.mediaPath, EXPORTS_DIR)
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))

    try:
        result = provider.transcribe(wav, req.language, req.providerOptions)
    except ProviderError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"{provider.id} failed: {e}")

    raw_path = _save_json(
        os.path.join(EXPORTS_DIR, f"raw_{provider.id}.json"), result.raw
    )

    opts = GroupingOptions.from_dict(req.grouping.model_dump())
    captions = group_words(result.words, opts)

    duration = result.duration or wav_duration(wav)
    document = build_document(
        source_media_path=req.mediaPath,
        language=req.language,
        provider=provider.id,
        duration=duration,
        words=result.words,
        captions=captions,
    )
    normalized_path = _save_json(os.path.join(EXPORTS_DIR, "normalized.json"), document)

    warnings = list(result.warnings)
    if result.timing_quality != "word":
        warnings.append(f"Timing quality: {result.timing_quality}.")
    if not document["words"]:
        warnings.append("Transcript has text but no word timings. "
                        "Animation requires word timings.")

    return {
        "document": document,
        "debugPaths": {
            "audio": wav,
            "rawProviderJson": raw_path,
            "normalizedJson": normalized_path,
        },
        "timingQuality": result.timing_quality,
        "warnings": warnings,
    }


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("KCF_PORT", "8765"))
    print(f"Kartuli Caption Forge backend v{VERSION} -> http://127.0.0.1:{port}")
    uvicorn.run(app, host="127.0.0.1", port=port)
