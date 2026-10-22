"""Local panel authentication and a deliberately small credential store."""
from __future__ import annotations

import os
import re
import secrets
import tempfile
from pathlib import Path
from threading import Lock

ALLOWED_KEYS = {"ELEVENLABS_API_KEY", "OPENAI_API_KEY", "GLADIA_API_KEY", "ASSEMBLYAI_API_KEY", "AZURE_SPEECH_KEY"}
_write_lock = Lock()


def local_token(backend_dir: str) -> str:
    path = Path(backend_dir) / ".local-token"
    with _write_lock:
        if path.exists():
            token = path.read_text(encoding="utf-8").strip()
            if re.fullmatch(r"[a-f0-9]{64}", token):
                return token
        token = secrets.token_hex(32)
        descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            handle.write(token)
        return token


def save_provider_key(backend_dir: str, name: str, value: str, region: str | None = None) -> None:
    if name not in ALLOWED_KEYS:
        raise ValueError("Choose a supported API-key provider.")
    if not value or len(value) > 2048 or any(char.isspace() for char in value) or any(char in value for char in "\"'\x00"):
        raise ValueError("API key must be a single value without spaces, quotes or line breaks.")
    updates = {name: value}
    if name == "AZURE_SPEECH_KEY":
        if not region or not re.fullmatch(r"[a-z][a-z0-9-]{1,48}", region):
            raise ValueError("Enter your Azure Speech region, for example westeurope.")
        updates["AZURE_SPEECH_REGION"] = region
    # Replace only requested keys. Preserve existing comments and provider configuration.
    with _write_lock:
        path = Path(backend_dir) / ".env"
        lines = path.read_text(encoding="utf-8").splitlines() if path.exists() else []
        lines = [line for line in lines if line.partition("=")[0].strip() not in updates]
        lines.extend(f"{key}={val}" for key, val in updates.items())
        descriptor, temp_path = tempfile.mkstemp(prefix=".env-", dir=backend_dir)
        try:
            with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
                handle.write("\n".join(lines) + "\n")
            os.replace(temp_path, path)
        finally:
            if os.path.exists(temp_path):
                os.unlink(temp_path)
        os.environ.update(updates)
