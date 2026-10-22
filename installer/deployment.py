"""Owned, per-user installation. Never scan/copy arbitrary repository content."""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from environment import data_root, extension_root

TOOL = "CapForge"
LEGACY_TOOL = "Kartuli Caption Forge"
VERSION = "0.3.1"
EXTENSION_ID = "com.kartuli.captionforge"
SOURCE = Path(__file__).resolve().parents[1]
RUNTIME_FILES = ("run_backend.bat", "run_backend.sh", "Install Windows.cmd", "Install macOS.command", "LICENSE", "README.md")


def _inside(path: Path, parent: Path) -> Path:
    resolved = path.resolve()
    if resolved == parent.resolve() or parent.resolve() not in resolved.parents:
        raise ValueError("Installation path escaped its destination.")
    # Keep the original path so callers can still reject a symlink, even when
    # its target happens to be inside the installation root.
    return path.absolute()


def _owned(root: Path, marker: str) -> bool:
    file = root / marker
    if not file.exists():
        return False
    try:
        return json.loads(file.read_text(encoding="utf-8-sig")).get("tool") in {TOOL, LEGACY_TOOL}
    except (ValueError, OSError):
        return False


def enable_unsigned() -> None:
    """Explicit installer option for the unsigned development build only."""
    if sys.platform == "win32":
        import winreg
        for version in (9, 10, 11, 12):
            with winreg.CreateKey(winreg.HKEY_CURRENT_USER, rf"Software\Adobe\CSXS.{version}") as key:
                winreg.SetValueEx(key, "PlayerDebugMode", 0, winreg.REG_SZ, "1")
    elif sys.platform == "darwin":
        for version in (9, 10, 11, 12):
            subprocess.run(["/usr/bin/defaults", "write", f"com.adobe.CSXS.{version}", "PlayerDebugMode", "1"], check=True, capture_output=True)


def install(target: Path | None = None, extensions: Path | None = None, *, dependencies: bool = True, unsigned: bool = False, progress=print) -> dict:
    if sys.version_info < (3, 10):
        raise RuntimeError("Open the CapForge setup launcher to prepare a compatible private runtime.")
    root_input = target or data_root()
    ext_input = extensions or extension_root()
    if root_input.is_symlink() or ext_input.is_symlink():
        raise ValueError("Choose an installation folder that is not a symbolic link.")
    root = root_input.resolve()
    ext_parent = ext_input.resolve()
    # Refuse to write into an unrelated non-empty destination or follow links.
    if root.is_symlink() or (root.exists() and any(root.iterdir()) and not _owned(root, ".kcf-install.json")):
        raise ValueError("This folder contains unrelated files. Choose an empty installation folder.")
    if (ext_parent / EXTENSION_ID).is_symlink():
        raise ValueError("The extension destination is a symbolic link.")
    extension = _inside(ext_parent / EXTENSION_ID, ext_parent)
    if extension.is_symlink() or (extension.exists() and not _owned(extension, "install.json")):
        raise ValueError("The extension destination is not owned by CapForge. Move it aside before installing.")
    root.mkdir(parents=True, exist_ok=True)
    ext_parent.mkdir(parents=True, exist_ok=True)
    marker = {"tool": TOOL, "version": VERSION, "runtimeRoot": str(root), "extension": str(extension)}
    # Mark before dependency work: failed installs can be retried safely.
    marker_file = root / ".kcf-install.json"
    old_marker = marker_file.read_text(encoding="utf-8") if marker_file.exists() else None
    marker_file.write_text(json.dumps(marker, indent=2), encoding="utf-8")
    staging = Path(tempfile.mkdtemp(prefix=".kcf-stage-", dir=root))
    backups = root / "backups" / datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S-%f")
    replaced: list[tuple[Path, Path | None]] = []
    ignore = shutil.ignore_patterns("__pycache__", "*.pyc", ".venv", "node_modules", "exports", "models", ".env", "config.env", ".local-token", ".env-*")
    try:
        progress("Preparing your caption studio…")
        for name in ("ae", "backend", "docs", "agents", "installer"):
            shutil.copytree(SOURCE / name, staging / name, ignore=ignore)
        # Credentials belong to the user's existing install, never to the source package.
        for name in (".env", "config.env", ".local-token"):
            existing = root / "backend" / name
            if existing.exists():
                shutil.copy2(existing, staging / "backend" / name)
        shutil.copytree(SOURCE / "panel", staging / "panel", ignore=shutil.ignore_patterns("install.json", "json2.js"))
        shutil.copy2(SOURCE / "ae/lib/json2.js", staging / "panel/json2.js")
        (staging / "panel/install.json").write_text(json.dumps(marker, indent=2), encoding="utf-8")
        runtime_files = RUNTIME_FILES + (("CapForge Setup.exe",) if (SOURCE / "CapForge Setup.exe").is_file() else ())
        for name in runtime_files:
            shutil.copy2(SOURCE / name, staging / name)
        shutil.copy2(SOURCE / "run_backend.sh", staging / "run_backend.command")
        (staging / "run_backend.command").chmod(0o755)
        if dependencies:
            progress("Preparing your private transcription service…")
            environment = _inside(root / ".venv", root)
            if environment.is_symlink():
                raise ValueError("The service environment is a symbolic link. Refusing to replace it.")
            python = environment / ("Scripts/python.exe" if sys.platform == "win32" else "bin/python")
            if python.exists():
                try:
                    healthy = subprocess.run([str(python), "-I", "-c", "import sys, pip"], capture_output=True, timeout=20).returncode == 0
                except (OSError, subprocess.TimeoutExpired):
                    healthy = False
                if not healthy:
                    # A removed earlier system Python can leave a broken venv.
                    # Keep it recoverable and build a new one with our runtime.
                    progress("Repairing the transcription service…")
                    backup = _inside(backups / "environment", root)
                    backup.parent.mkdir(parents=True, exist_ok=True)
                    shutil.move(str(environment), str(backup))
                    replaced.append((environment, backup))
            if not python.exists():
                subprocess.run([sys.executable, "-m", "venv", str(environment)], check=True, capture_output=True, text=True)
            progress("Installing the transcription service (internet required)…")
            cache = _inside(root / ".runtime/pip-cache", root)
            result = subprocess.run([str(python), "-m", "pip", "--isolated", "install", "--disable-pip-version-check", "--cache-dir", str(cache), "-r", str(staging / "backend/requirements.txt")], capture_output=True, text=True)
            if result.returncode:
                raise RuntimeError("Could not install the service packages. Check your internet connection and retry.\n" + (result.stderr or result.stdout)[-900:])
            progress("Checking audio preparation…")
            subprocess.run([str(python), "-I", "-c", "import imageio_ffmpeg; imageio_ffmpeg.get_ffmpeg_exe()"], check=True, capture_output=True, text=True)
        progress("Installing the After Effects panel…")
        for name in ("ae", "backend", "docs", "agents", "installer", "panel", "run_backend.command") + runtime_files:
            destination = _inside(root / name, root)
            backup = None
            if destination.is_symlink():
                raise ValueError("An installed file is a symbolic link. Refusing to replace it.")
            if destination.exists():
                backups.mkdir(parents=True, exist_ok=True)
                backup = backups / name
                shutil.move(str(destination), str(backup))
            replaced.append((destination, backup))
            shutil.move(str(staging / name), str(destination))
        # Stage the extension on the same filesystem before replacing it.
        ext_stage = Path(tempfile.mkdtemp(prefix=".kcf-stage-", dir=ext_parent))
        try:
            shutil.copytree(root / "panel", ext_stage / EXTENSION_ID)
            backup = None
            if extension.exists():
                backups.mkdir(parents=True, exist_ok=True)
                backup = backups / "extension"
                shutil.move(str(extension), str(backup))
            replaced.append((extension, backup))
            shutil.move(str(ext_stage / EXTENSION_ID), str(extension))
        finally:
            _inside(ext_stage, ext_parent)
            shutil.rmtree(ext_stage)
        if unsigned:
            progress("Enabling this unsigned development panel for your user account…")
            enable_unsigned()
        progress("Installed. Restart AE, then open Window → Extensions → CapForge.")
        return marker
    except Exception:
        # Restore the previous files if replacement fails; keep outputs and venv.
        for destination, backup in reversed(replaced):
            if destination.exists():
                if destination.is_dir():
                    _inside(destination, root if root in destination.parents else ext_parent)
                    shutil.rmtree(destination)
                else:
                    destination.unlink()
            if backup and backup.exists():
                shutil.move(str(backup), str(destination))
        if old_marker is not None:
            marker_file.write_text(old_marker, encoding="utf-8")
        raise
    finally:
        _inside(staging, root)
        shutil.rmtree(staging)
