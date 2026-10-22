"""Local-only smoke check. Never sends media, saves keys or reveals the token."""
import json
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]
BASE = "http://127.0.0.1:8765"
token = (ROOT / "backend/.local-token").read_text().strip()
headers = {"X-KCF-Token": token}
health = requests.get(BASE + "/health", timeout=5)
assert health.status_code == 200 and health.json()["ok"]
assert requests.get(BASE + "/providers", timeout=5).status_code == 401
assert requests.get(BASE + "/providers", headers={**headers,"Origin":"https://example.invalid"}, timeout=5).status_code == 403
providers = requests.get(BASE + "/providers", headers=headers, timeout=5)
assert providers.status_code == 200 and providers.json()["providers"]
doc = json.loads((ROOT / "backend/tests/fixtures/georgian_short.json").read_text(encoding="utf-8"))
regroup = requests.post(BASE + "/regroup", headers={**headers,"Origin":"null"}, json={"document":doc,"grouping":{"minWords":1,"maxWords":2}}, timeout=5)
assert regroup.status_code == 200
assert regroup.json()["document"]["words"] == doc["words"]
print("Live local service passed: readiness, authentication, web-origin rejection, provider listing and timing-preserving regrouping.")
