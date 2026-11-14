"""Signing setup fails closed without ever touching real credentials/keychains."""
import base64
import json
import os
from pathlib import Path
import shlex
import subprocess
import sys
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / "prepare_macos_signing.sh"
SECRETS = {
    "CAPFORGE_APPLE_CERTIFICATE_P12": base64.b64encode(b"fixture certificate, not a real P12").decode(),
    "CAPFORGE_APPLE_CERTIFICATE_PASSWORD": "fixture-p12-password",
    "CAPFORGE_APPLE_ID": "fixture@example.invalid",
    "CAPFORGE_APPLE_APP_PASSWORD": "fixture-app-password",
    "CAPFORGE_APPLE_TEAM_ID": "AB12345678",
}
FINGERPRINT = "A" * 40
IDENTITY = f'  1) {FINGERPRINT} "Developer ID Application: Fixture Company (AB12345678)"\n  1 valid identities found\n'


@unittest.skipUnless(sys.platform == "darwin", "macOS Bash signing setup")
class MacSigningSetupTests(unittest.TestCase):
    def setUp(self):
        folder = tempfile.TemporaryDirectory(prefix="CapForge signing fixture ")
        self.addCleanup(folder.cleanup)
        self.root = Path(folder.name)
        self.bin = self.root / "bin"
        self.bin.mkdir()
        mock = self.root / "mock_tool.py"
        mock.write_text('''import json
import os
from pathlib import Path
import sys

tool, arguments = sys.argv[1], sys.argv[2:]
with open(os.environ["FAKE_TOOL_LOG"], "a") as log:
    log.write(json.dumps([tool, *arguments]) + "\\n")
if tool == "openssl":
    print("c" * 64)
elif tool == "security" and arguments[0] == "create-keychain":
    Path(arguments[-1]).touch()
elif tool == "security" and arguments[0] == "find-identity":
    print(os.environ["FAKE_IDENTITY_OUTPUT"])
elif tool == "xcrun" and os.environ.get("FAKE_NOTARY_FAIL") == "1":
    raise SystemExit(1)
''', encoding="utf-8")
        for tool in ("security", "xcrun", "openssl"):
            executable = self.bin / tool
            executable.write_text("#!/bin/bash\nexec " + shlex.quote(sys.executable) + " "
                                  + shlex.quote(str(mock)) + " " + shlex.quote(tool) + ' "$@"\n')
            executable.chmod(0o755)
        (self.bin / "python").symlink_to(sys.executable)
        self.environment = {key: value for key, value in os.environ.items()
                            if not key.startswith("CAPFORGE_APPLE_")}
        self.environment.update({
            "PATH": str(self.bin) + os.pathsep + os.environ.get("PATH", ""),
            "RUNNER_TEMP": str(self.root),
            "GITHUB_OUTPUT": str(self.root / "outputs"),
            "GITHUB_ENV": str(self.root / "environment"),
            "FAKE_TOOL_LOG": str(self.root / "calls.jsonl"),
            "FAKE_IDENTITY_OUTPUT": IDENTITY,
        })

    def run_setup(self, secrets=None, **environment):
        return subprocess.run(["/bin/bash", str(SCRIPT)],
                              env={**self.environment, **(secrets or {}), **environment},
                              capture_output=True, text=True, timeout=15)

    def read(self, name):
        path = self.root / name
        return path.read_text() if path.exists() else ""

    def calls(self):
        return [json.loads(line) for line in self.read("calls.jsonl").splitlines()]

    def test_no_credentials_builds_preview_without_touching_keychain(self):
        result = self.run_setup()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.read("outputs"), "configured=false\n")
        self.assertEqual(self.read("environment"), "")
        self.assertEqual(self.calls(), [])

    def test_partial_configuration_fails_before_any_credential_operation(self):
        result = self.run_setup({"CAPFORGE_APPLE_ID": SECRETS["CAPFORGE_APPLE_ID"]})
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Missing secrets", result.stdout)
        self.assertNotIn(SECRETS["CAPFORGE_APPLE_ID"], result.stdout + result.stderr)
        self.assertEqual(self.calls(), [])
        self.assertEqual(self.read("outputs"), "")

    def test_complete_configuration_uses_private_keychain_and_validated_notary_profile(self):
        # macOS base64/pbcopy output commonly includes whitespace and a newline.
        encoded = SECRETS["CAPFORGE_APPLE_CERTIFICATE_P12"]
        secrets = {**SECRETS, "CAPFORGE_APPLE_CERTIFICATE_P12": encoded[:20] + "\n" + encoded[20:] + "\n"}
        result = self.run_setup(secrets)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.read("outputs"), "configured=true\n")
        keychain = str(self.root / "capforge-signing.keychain-db")
        self.assertEqual(self.read("environment"),
                         f"CAPFORGE_MACOS_SIGNING_IDENTITY={FINGERPRINT}\nCAPFORGE_SIGNING_KEYCHAIN={keychain}\n")
        calls = self.calls()
        self.assertEqual([call[1] for call in calls if call[0] == "security"],
                         ["create-keychain", "set-keychain-settings", "unlock-keychain", "import",
                          "set-key-partition-list", "find-identity"])
        imported = next(call for call in calls if call[:2] == ["security", "import"])
        self.assertEqual(imported[imported.index("-k") + 1], keychain)
        self.assertEqual(imported[imported.index("-T") + 1], "/usr/bin/codesign")
        notary = calls[-1]
        self.assertEqual(notary[:4], ["xcrun", "notarytool", "store-credentials", "CapForgeNotary"])
        self.assertEqual(notary[notary.index("--keychain") + 1], keychain)
        self.assertIn("--validate", notary)
        self.assertFalse((self.root / "capforge-certificate.p12").exists())
        for name in ("CAPFORGE_APPLE_CERTIFICATE_P12", "CAPFORGE_APPLE_CERTIFICATE_PASSWORD", "CAPFORGE_APPLE_APP_PASSWORD"):
            self.assertNotIn(SECRETS[name], result.stdout + result.stderr)

    def test_wrong_certificate_team_or_duplicate_identity_cannot_enable_release(self):
        wrong = [IDENTITY.replace("AB12345678", "XY98765432"),
                 IDENTITY.replace("Developer ID Application:", "Apple Development:"),
                 IDENTITY + IDENTITY, "  0 valid identities found"]
        for identity in wrong:
            with self.subTest(identity=identity):
                result = self.run_setup(SECRETS, FAKE_IDENTITY_OUTPUT=identity)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("exactly one valid Developer ID Application identity", result.stderr)
                self.assertEqual(self.read("outputs"), "")
                self.assertEqual(self.read("environment"), "")
                self.assertFalse((self.root / "capforge-certificate.p12").exists())
                self.assertFalse(any(call[0] == "xcrun" for call in self.calls()))

    def test_rejected_notary_credentials_cannot_enable_release(self):
        result = self.run_setup(SECRETS, FAKE_NOTARY_FAIL="1")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.read("outputs"), "")
        self.assertEqual(self.read("environment"), "")
        self.assertFalse((self.root / "capforge-certificate.p12").exists())


if __name__ == "__main__":
    unittest.main()
