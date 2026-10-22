"""Read-only prerequisite checks, shared by the installer and CLI."""
from __future__ import annotations

import os
import shutil
import sys
from pathlib import Path


def data_root() -> Path:
    if sys.platform == "win32":
        parent = Path(os.environ.get("LOCALAPPDATA", str(Path.home() / "AppData/Local")))
    elif sys.platform == "darwin":
        parent = Path.home() / "Library/Application Support"
    else:
        parent = Path.home() / ".local/share"
    # Keep an owned earlier install in place: its venv and private runtime use
    # absolute paths. A product rename must not invalidate them or lose keys.
    legacy = parent / "Kartuli Caption Forge"
    try:
        import json
        if json.loads((legacy / ".kcf-install.json").read_text(encoding="utf-8-sig")).get("tool") in {"CapForge", "Kartuli Caption Forge"}:
            return legacy
    except (ValueError, OSError):
        pass
    return parent / "CapForge"


def extension_root() -> Path:
    if sys.platform == "win32":
        return Path(os.environ.get("APPDATA", str(Path.home() / "AppData/Roaming"))) / "Adobe/CEP/extensions"
    if sys.platform == "darwin":
        return Path.home() / "Library/Application Support/Adobe/CEP/extensions"
    return Path.home() / ".local/share/Adobe/CEP/extensions"


def ffmpeg_path() -> str | None:
    found = shutil.which("ffmpeg")
    if found:
        return found
    for candidate in ("/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg", "C:/ffmpeg/bin/ffmpeg.exe", "C:/Program Files/ffmpeg/bin/ffmpeg.exe"):
        if Path(candidate).is_file():
            return candidate
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except (ImportError, RuntimeError):
        return None


def diagnostics() -> list[tuple[str, bool, str]]:
    ffmpeg = ffmpeg_path()
    return [
        ("App components", sys.version_info >= (3, 10), "Ready" if sys.version_info >= (3, 10) else "Run CapForge Setup to prepare the app."),
        ("Audio preparation", bool(ffmpeg), "Ready" if ffmpeg else "Prepared automatically during installation."),
        ("After Effects panel", sys.platform in ("win32", "darwin"), "macOS and Windows supported" if sys.platform in ("win32", "darwin") else "Backend only on Linux; Adobe does not ship AE for Linux"),
    ]
