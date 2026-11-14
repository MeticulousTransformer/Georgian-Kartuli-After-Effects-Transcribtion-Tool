"""Apple notarization using an existing Keychain credential profile.

No passwords or private keys are accepted here. A successful upload is not an
approval: only Apple's Accepted status permits stapling and distribution.
"""
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

DEVELOPER_ID_REQUIREMENT = (
    "=anchor apple generic and "
    "certificate 1[field.1.2.840.113635.100.6.2.6] exists and "
    "certificate leaf[field.1.2.840.113635.100.6.1.13] exists"
)


def run(*arguments: str | Path) -> None:
    subprocess.run([str(value) for value in arguments], check=True)


def verify_developer_id(path: Path) -> None:
    """Check the actual certificate, including when signing used its SHA-1 ID."""
    run("/usr/bin/codesign", "--verify", "--deep", "--strict",
        "--test-requirement", DEVELOPER_ID_REQUIREMENT, path)


def _text(value: str | bytes | None) -> str:
    return value.decode("utf-8", errors="replace") if isinstance(value, bytes) else (value or "")


def _record_result(path: Path, stdout: str, stderr: str, *, returncode: int | None) -> dict:
    try:
        result = json.loads(stdout)
    except ValueError:
        result = None
    # Keep Apple's submission ID even when waiting timed out. Non-JSON failures
    # remain inspectable without ever serializing command arguments/credentials.
    record = {"response": result, "returncode": returncode}
    if result is None:
        record["stdout"] = stdout
    if stderr:
        record["stderr"] = stderr
    path.write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return result if isinstance(result, dict) else {}


def submit(artifact: Path, *, profile: str, keychain: Path | None,
           diagnostics: Path, label: str) -> str:
    """Wait for approval, retaining Apple's response and rejection diagnostics."""
    if not profile.strip():
        raise ValueError("Notarization needs an existing Keychain credential profile.")
    diagnostics.mkdir(parents=True, exist_ok=True)
    auth = ["--keychain-profile", profile]
    if keychain is not None:
        auth.extend(["--keychain", str(keychain)])
    command = ["xcrun", "notarytool", "submit", str(artifact), *auth,
               "--wait", "--timeout", "30m", "--output-format", "json"]
    response_path = diagnostics / (label + "-submit.json")
    try:
        completed = subprocess.run(command, capture_output=True, text=True, timeout=40 * 60)
        response = _record_result(response_path, completed.stdout, completed.stderr,
                                  returncode=completed.returncode)
        succeeded = completed.returncode == 0
    except subprocess.TimeoutExpired as error:
        response = _record_result(response_path, _text(error.stdout), _text(error.stderr), returncode=None)
        succeeded = False
    submission_id = response.get("id")
    valid_id = isinstance(submission_id, str) and re.fullmatch(
        r"[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}", submission_id)
    if succeeded and response.get("status") == "Accepted" and valid_id:
        print(f"Apple accepted {label} submission {submission_id}.", flush=True)
        return submission_id
    if valid_id:
        log_path = diagnostics / (label + "-log.json")
        try:
            result = subprocess.run(["xcrun", "notarytool", "log", submission_id, *auth],
                                    capture_output=True, text=True, timeout=120)
            _record_result(log_path, result.stdout, result.stderr, returncode=result.returncode)
        except subprocess.TimeoutExpired as error:
            _record_result(log_path, _text(error.stdout), _text(error.stderr), returncode=None)
    status = response.get("status", "no completed approval")
    reference = f" Submission: {submission_id}." if valid_id else ""
    raise RuntimeError(
        f"Apple notarization did not succeed for {label} ({status}).{reference} "
        f"See {response_path}. If processing is still in progress, Apple may finish later; "
        "this build is not approved for release."
    )


def staple(path: Path) -> None:
    run("xcrun", "stapler", "staple", path)
    run("xcrun", "stapler", "validate", path)


def verify_distribution(app: Path, dmg: Path | None = None) -> None:
    verify_developer_id(app)
    run("xcrun", "stapler", "validate", app)
    run("/usr/sbin/spctl", "--assess", "--type", "execute", "--verbose=2", app)
    if Path("/usr/bin/syspolicy_check").is_file():
        run("/usr/bin/syspolicy_check", "distribution", app)
    if dmg is not None:
        verify_developer_id(dmg)
        run("xcrun", "stapler", "validate", dmg)
        run("/usr/sbin/spctl", "--assess", "--type", "open", "--context",
            "context:primary-signature", "--verbose=2", dmg)
