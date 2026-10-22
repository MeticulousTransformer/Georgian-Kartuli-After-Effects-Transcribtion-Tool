"""Build a small distributable from an explicit allowlist, never a repo snapshot."""
from __future__ import annotations

import hashlib
import json
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NAME = "CapForge-0.3.1-preview"
FOLDERS = ("panel", "ae", "backend", "installer", "agents", "docs", "scripts")
FILES = ("README.md", "AGENTS.md", "LICENSE", "Install Windows.cmd", "Install macOS.command", "run_backend.bat", "run_backend.sh")
EXTENSIONS = {".py", ".ps1", ".sh", ".cs", ".jsx", ".js", ".html", ".css", ".xml", ".json", ".md", ".txt", ".env", ".example", ".png"}


def members():
    for name in FILES:
        yield ROOT / name
    if (ROOT / "CapForge Setup.exe").is_file():
        yield ROOT / "CapForge Setup.exe"
    for folder in FOLDERS:
        for path in sorted((ROOT / folder).rglob("*")):
            if not path.is_file() or path.is_symlink() or any(part in {"__pycache__", ".venv", "node_modules", "exports", "models"} for part in path.relative_to(ROOT).parts):
                continue
            if path.name in {".env", "config.env", ".local-token", "install.json"} or path.name.startswith(".env-"):
                continue
            if path.suffix in EXTENSIONS:
                yield path


def main():
    from sync_preview_styles import build
    build()
    if sys.platform == "win32":
        subprocess.run(["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(ROOT / "scripts/build_windows_launcher.ps1")], check=True)
    destination = ROOT / "dist"
    destination.mkdir(exist_ok=True)
    archive = destination / (NAME + ".zip")
    manifest = []
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as package:
        for path in members():
            relative = path.relative_to(ROOT).as_posix()
            data = path.read_bytes()
            info = zipfile.ZipInfo(NAME + "/" + relative)
            info.create_system = 3
            info.external_attr = (0o100755 if path.suffix in (".command", ".sh") else 0o100644) << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            package.writestr(info, data)
            manifest.append({"path": relative, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()})
        package.writestr(NAME + "/package-manifest.json", json.dumps(manifest, indent=2))
    print(f"Created {archive}\n{len(manifest)} files · {archive.stat().st_size:,} bytes")


if __name__ == "__main__": main()
