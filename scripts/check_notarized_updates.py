"""Verify the notarized app survives both final Mac update ZIPs unchanged."""
from __future__ import annotations

import argparse
import json
from pathlib import Path, PurePosixPath
import stat
import subprocess
import sys
import tempfile
import zipfile

from check_release import check_archive, check_versions
from notarize_macos import verify_distribution


def check_update(archive: Path, version: str, *, legacy: bool = False) -> dict:
    # This verifies the final ZIP's checksum, complete manifest and expected
    # GITHUB_SHA/CAPFORGE_RELEASE_TAG before any file is extracted.
    check_archive(archive, version)
    prefix = "CapForge-" + version + "/"
    app_path = "CapForge.app/"
    executable = app_path + "Contents/MacOS/CapForge"
    with zipfile.ZipFile(archive) as package:
        release = json.loads(package.read(prefix + "release.json"))
        if release.get("platform") != (None if legacy else "macos"):
            raise ValueError("Wrong update platform in " + archive.name)
        payload = json.loads(package.read(prefix + app_path + "Contents/Resources/payload/release.json"))
        for key in ("version", "tag", "commit"):
            if not release.get(key) or payload.get(key) != release[key]:
                raise ValueError("Native app payload has the wrong " + key)
        if package.getinfo(prefix + executable).external_attr >> 16 & 0o111 != 0o111:
            raise ValueError("Native Mac executable is not executable in " + archive.name)
        with tempfile.TemporaryDirectory(prefix="CapForge notarized update ქართული ") as folder:
            root = Path(folder).resolve()
            for info in package.infolist():
                relative = PurePosixPath(info.filename)
                mode = info.external_attr >> 16
                if (relative.is_absolute() or ".." in relative.parts or "\\" in info.filename
                        or relative.as_posix() != info.filename
                        or stat.S_IFMT(mode) not in (0, stat.S_IFREG)):
                    raise ValueError("Unsafe update path: " + info.filename)
                target = root.joinpath(*relative.parts)
                target.parent.mkdir(parents=True, exist_ok=True)
                # Exclusive creation also rejects path aliases on Mac filesystems.
                with target.open("xb") as destination:
                    destination.write(package.read(info))
                target.chmod(0o755 if mode & 0o111 else 0o644)
            verify_distribution(root / prefix / "CapForge.app")
    return release


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--macos-archive", type=Path, required=True)
    parser.add_argument("--legacy-archive", type=Path, required=True)
    args = parser.parse_args()
    if sys.platform != "darwin":
        parser.error("Notarized update validation must run on macOS.")
    version = check_versions()
    macos = check_update(args.macos_archive, version)
    legacy = check_update(args.legacy_archive, version, legacy=True)
    if any(macos[key] != legacy[key] for key in ("version", "tag", "commit")):
        raise ValueError("Mac and legacy updates contain different releases.")
    print("Both final update ZIPs preserve the verified notarized Mac app.")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, KeyError, subprocess.CalledProcessError, zipfile.BadZipFile) as error:
        print("Notarized update check failed: " + str(error), file=sys.stderr)
        raise SystemExit(1)
