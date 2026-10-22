"""Authentication, credential storage, input validation and regroup integration."""
import asyncio
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import app, GroupingModel
from services.studio_settings import local_token, save_provider_key
from services.transcript_validation import validate_document

FIXTURE = Path(__file__).parent / "fixtures/georgian_short.json"


async def request(path, method="GET", payload=None, headers=None):
    """Minimal ASGI client: runs the real middleware without another dependency."""
    body = json.dumps(payload).encode() if payload else b""
    incoming = [(b"host", b"127.0.0.1"), (b"content-type", b"application/json"), (b"content-length", str(len(body)).encode())]
    for key, value in (headers or {}).items():
        incoming = [(k, v) for k, v in incoming if k != key.lower().encode()]
        incoming.append((key.lower().encode(), value.encode()))
    scope = {"type":"http", "asgi":{"version":"3.0"}, "http_version":"1.1", "method":method, "scheme":"http", "path":path, "raw_path":path.encode(), "query_string":b"", "headers":incoming, "client":("127.0.0.1",1234), "server":("127.0.0.1",8765)}
    received, messages = False, []
    async def receive():
        nonlocal received
        if not received:
            received = True
            return {"type":"http.request", "body":body, "more_body":False}
        await asyncio.Event().wait()
    async def send(message):
        messages.append(message)
    await asyncio.wait_for(app(scope, receive, send), timeout=3)
    status = next(m["status"] for m in messages if m["type"] == "http.response.start")
    data = b"".join(m.get("body",b"") for m in messages if m["type"] == "http.response.body")
    try:
        result = json.loads(data) if data else None
    except ValueError:
        result = data.decode()
    return status, result


class TestLocalSettings(unittest.TestCase):
    def test_token_is_persistent_and_private(self):
        with tempfile.TemporaryDirectory() as folder:
            first = local_token(folder)
            self.assertEqual(first, local_token(folder))
            self.assertEqual(len(first), 64)
            if os.name != "nt":
                self.assertEqual((Path(folder)/".local-token").stat().st_mode & 0o777, 0o600)

    def test_key_save_preserves_other_configuration_and_updates_live_environment(self):
        with tempfile.TemporaryDirectory() as folder, patch.dict(os.environ, {}, clear=False):
            path = Path(folder)/".env"
            path.write_text("# Keep this\nGOOGLE_CLOUD_PROJECT=example\nELEVENLABS_API_KEY=old\n",encoding="utf-8")
            save_provider_key(folder,"ELEVENLABS_API_KEY","test-new-key")
            self.assertIn("GOOGLE_CLOUD_PROJECT=example", path.read_text())
            self.assertNotIn("=old", path.read_text())
            self.assertEqual(os.environ["ELEVENLABS_API_KEY"], "test-new-key")
            self.assertEqual(list(Path(folder).glob(".env-*")), [])

    def test_rejects_env_injection_and_arbitrary_configuration(self):
        with tempfile.TemporaryDirectory() as folder:
            for name, value, region in [("PATH","value",None),("OPENAI_API_KEY","key\nPATH=bad",None),("OPENAI_API_KEY","quoted'key",None),("AZURE_SPEECH_KEY","key","evil.example.com")]:
                with self.assertRaises(ValueError): save_provider_key(folder,name,value,region)
            self.assertFalse((Path(folder)/".env").exists())

    def test_grouping_limits_are_checked(self):
        for values in [{"maxWords":7},{"pauseBreakSeconds":-1},{"minWords":4,"maxWords":2}]:
            with self.assertRaises(ValueError): GroupingModel(**values)


class TestStudioAPI(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.folder = self.temp.name
        self.override = patch("app.BACKEND_DIR", self.folder)
        self.override.start()
        self.token = local_token(self.folder)

    async def asyncTearDown(self):
        self.override.stop()
        self.temp.cleanup()

    async def test_missing_token_cannot_read_providers_or_process_media(self):
        for path, method, data in [("/providers","GET",None),("/transcribe","POST",{"mediaPath":"private.wav"}),("/regroup","POST",{})]:
            status, _ = await request(path,method,data)
            self.assertEqual(status,401)

    async def test_hostile_web_origin_is_blocked_even_with_token(self):
        status, _ = await request("/providers",headers={"X-KCF-Token":self.token,"Origin":"https://evil.example"})
        self.assertEqual(status,403)
        status, _ = await request("/providers",headers={"X-KCF-Token":self.token,"Host":"evil.example"})
        self.assertEqual(status,400)

    async def test_cep_file_origins_can_connect_with_installation_token(self):
        for origin in ("file://", "null"):
            with self.subTest(origin=origin):
                status, result = await request("/health", headers={"Origin":origin})
                self.assertEqual(status,200)
                self.assertTrue(result["ok"])
                status, _ = await request("/providers", headers={"Origin":origin,"X-KCF-Token":self.token})
                self.assertEqual(status,200)
                status, _ = await request("/providers", headers={"Origin":origin})
                self.assertEqual(status,401)

    async def test_cep_file_origin_preflight_is_accepted(self):
        status, _ = await request("/providers", "OPTIONS", headers={
            "Origin":"file://", "Access-Control-Request-Method":"GET",
            "Access-Control-Request-Headers":"content-type,x-kcf-token"
        })
        self.assertEqual(status,200)

    async def test_other_origin_forms_are_still_blocked(self):
        for origin in ("http://localhost:3000", "http://127.0.0.1:8765", "file://evil.example", "file:///", "https://evil.example"):
            with self.subTest(origin=origin):
                status, _ = await request("/health", headers={"Origin":origin,"X-KCF-Token":self.token})
                self.assertEqual(status,403)

    async def test_regroup_keeps_word_timestamps_ids_and_georgian_unicode(self):
        doc = json.loads(FIXTURE.read_text(encoding="utf-8"))
        status, result = await request("/regroup","POST",{"document":doc,"grouping":{"minWords":1,"maxWords":1}}, {"X-KCF-Token":self.token,"Origin":"null"})
        self.assertEqual(status,200)
        self.assertEqual(result["document"]["words"], doc["words"])
        self.assertEqual(len(result["document"]["captions"]), len(doc["words"]))

    async def test_key_response_never_echoes_secret(self):
        with patch.dict(os.environ, {}, clear=False):
            status, result = await request("/settings/provider-key","POST",{"name":"OPENAI_API_KEY","value":"test-only-secret"},{"X-KCF-Token":self.token})
            self.assertEqual(status,200)
            self.assertEqual(result,{"ok":True})

    async def test_invalid_key_validation_does_not_echo_input(self):
        secret = "s" * 2049
        status, result = await request("/settings/provider-key","POST",{"name":"OPENAI_API_KEY","value":secret},{"X-KCF-Token":self.token})
        self.assertEqual(status,422)
        self.assertNotIn(secret,json.dumps(result))

    async def test_invalid_document_fails_before_grouping(self):
        doc = json.loads(FIXTURE.read_text(encoding="utf-8")); doc["words"][0]["end"] = -1
        with self.assertRaises(ValueError): validate_document(doc)
        status, _ = await request("/regroup","POST",{"document":doc},{"X-KCF-Token":self.token})
        self.assertEqual(status,400)


if __name__ == "__main__": unittest.main()
