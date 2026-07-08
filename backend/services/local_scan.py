"""Scan local machine for offline ASR tools and models. Cross-platform."""
from __future__ import annotations

import importlib.util
import os
import platform
import shutil
from typing import List, Optional

from services.audio_extract import find_ffmpeg

WHISPER_CPP_BINARIES = ["whisper-cli", "whisper-cpp", "main"]

WHISPER_CPP_BIN_DIRS = [
    "/opt/homebrew/bin",                                # macOS Apple Silicon
    "/usr/local/bin",                                   # macOS Intel / Linux
    "/usr/bin",                                         # Linux
    "./vendor/whisper.cpp/build/bin",
    os.path.expanduser("~/whisper.cpp/build/bin"),
    "C:\\whisper.cpp\\build\\bin",                      # Windows
    "C:\\whisper\\bin",
]

WHISPER_MODEL_DIRS = [
    os.path.expanduser("~/models/whisper"),
    os.path.expanduser("~/.cache/whisper"),
    "./models",
    os.path.expanduser("~/whisper.cpp/models"),
    "./vendor/whisper.cpp/models",
]

# Best-first for Georgian. Never .en models for ka.
WHISPER_MODEL_PREFERENCE = [
    "ggml-large-v3-turbo.bin",
    "ggml-large-v3.bin",
    "ggml-large-v2.bin",
    "ggml-medium.bin",
    "ggml-small.bin",
    "ggml-base.bin",
]


def find_whisper_cpp_binary() -> Optional[str]:
    for name in WHISPER_CPP_BINARIES:
        path = shutil.which(name)
        if path:
            return path
    exts = [".exe", ""] if os.name == "nt" else [""]
    for d in WHISPER_CPP_BIN_DIRS:
        for name in WHISPER_CPP_BINARIES:
            for ext in exts:
                cand = os.path.join(d, name + ext)
                if os.path.isfile(cand):
                    return cand
    return None


def list_whisper_models() -> List[str]:
    found = []
    for d in WHISPER_MODEL_DIRS:
        if not os.path.isdir(d):
            continue
        for f in sorted(os.listdir(d)):
            if f.startswith("ggml") and f.endswith(".bin"):
                found.append(os.path.join(d, f))
    return found


def find_whisper_model(language: str = "ka") -> Optional[str]:
    models = list_whisper_models()
    if not models:
        return None
    if language.startswith("ka"):
        models = [m for m in models if ".en." not in m and not m.endswith(".en.bin")]
    by_name = {os.path.basename(m): m for m in models}
    for pref in WHISPER_MODEL_PREFERENCE:
        if pref in by_name:
            return by_name[pref]
    return models[0] if models else None


def module_available(name: str) -> bool:
    try:
        return importlib.util.find_spec(name) is not None
    except (ImportError, ValueError):
        return False


def is_apple_silicon() -> bool:
    return platform.system() == "Darwin" and platform.machine() == "arm64"


def scan_local() -> dict:
    binary = find_whisper_cpp_binary()
    return {
        "platform": f"{platform.system()} {platform.machine()}",
        "ffmpeg": find_ffmpeg(),
        "whisperCppBinary": binary,
        "whisperCppModels": list_whisper_models(),
        "fasterWhisperInstalled": module_available("faster_whisper"),
        "mlxWhisperInstalled": is_apple_silicon() and module_available("mlx_whisper"),
    }
