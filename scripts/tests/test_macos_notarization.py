"""Release trust checks without an Apple account or network access."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import build_macos
import notarize_macos

SUBMISSION_ID = "12345678-abcd-abcd-abcd-123456789abc"


class NotarySubmissionTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)

    def submit(self):
        return notarize_macos.submit(self.root / "CapForge.zip", profile="capforge-notary",
                                    keychain=self.root / "signing.keychain-db",
                                    diagnostics=self.root / "notarization", label="app")

    def result(self, status="Accepted", returncode=0):
        return subprocess.CompletedProcess([], returncode,
                                           json.dumps({"id": SUBMISSION_ID, "status": status}), "")

    def test_only_accepted_response_succeeds_and_uses_profile(self):
        with patch.object(notarize_macos.subprocess, "run", return_value=self.result()) as run:
            self.assertEqual(self.submit(), SUBMISSION_ID)
        command = run.call_args.args[0]
        self.assertIn("--wait", command)
        self.assertEqual(command[command.index("--output-format") + 1], "json")
        self.assertEqual(command[command.index("--keychain-profile") + 1], "capforge-notary")
        self.assertEqual(command[command.index("--keychain") + 1], str(self.root / "signing.keychain-db"))
        self.assertNotIn("--password", command)
        response = json.loads((self.root / "notarization/app-submit.json").read_text())
        self.assertEqual(response["response"]["id"], SUBMISSION_ID)

    def test_rejection_keeps_submission_and_useful_apple_log(self):
        log = {"jobId": SUBMISSION_ID, "issues": [{"message": "The executable does not have hardened runtime enabled."}]}
        with patch.object(notarize_macos.subprocess, "run", side_effect=[
            self.result("Invalid"), subprocess.CompletedProcess([], 0, json.dumps(log), "")
        ]) as run:
            with self.assertRaisesRegex(RuntimeError, SUBMISSION_ID):
                self.submit()
        self.assertEqual(run.call_args.args[0][:4], ["xcrun", "notarytool", "log", SUBMISSION_ID])
        self.assertEqual(json.loads((self.root / "notarization/app-log.json").read_text())["response"], log)

    def test_pending_rejected_and_unknown_status_never_succeed(self):
        for status in ("In Progress", "Rejected", "Upload Complete", "accepted", None):
            with self.subTest(status=status), patch.object(notarize_macos.subprocess, "run", return_value=self.result(status)):
                with self.assertRaisesRegex(RuntimeError, "not approved for release"):
                    self.submit()

    def test_nonzero_exit_even_with_accepted_status_fails(self):
        with patch.object(notarize_macos.subprocess, "run", return_value=self.result(returncode=1)):
            with self.assertRaises(RuntimeError):
                self.submit()

    def test_timeout_does_not_count_as_approval_and_preserves_id(self):
        timeout = subprocess.TimeoutExpired(["notarytool"], 2400,
                                           output=self.result("In Progress").stdout.encode())
        with patch.object(notarize_macos.subprocess, "run", side_effect=[timeout, timeout]):
            with self.assertRaisesRegex(RuntimeError, SUBMISSION_ID):
                self.submit()
        response = json.loads((self.root / "notarization/app-submit.json").read_text())
        self.assertIsNone(response["returncode"])
        self.assertEqual(response["response"]["status"], "In Progress")

    def test_malformed_or_missing_submission_id_fails(self):
        for stdout in ("", "not json", "[]", '{"status":"Accepted"}', '{"id":"bad","status":"Accepted"}'):
            with self.subTest(stdout=stdout), patch.object(notarize_macos.subprocess, "run",
                                                          return_value=subprocess.CompletedProcess([], 0, stdout, "")) as run:
                with self.assertRaises(RuntimeError):
                    self.submit()
                self.assertEqual(run.call_count, 1)


class NotaryBuildTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.app = self.root / "CapForge.app"
        self.dmg = self.root / "CapForge-0.3.3-macOS.dmg"
        self.events = []
        self.failure = None

        def event(name):
            self.events.append(name)
            if self.failure == name:
                raise RuntimeError("simulated " + name + " failure")

        def app(*args, **kwargs):
            event("build-app")
            self.app.mkdir()
            return self.app, {"version": "0.3.3"}

        def dmg(*args, **kwargs):
            event("build-dmg")
            self.dmg.write_bytes(b"disk image")
            return self.dmg

        def run(*command):
            event("sign-dmg" if command[0] == "/usr/bin/codesign" else "archive-app")

        def staple(path):
            event("staple-" + ("app" if path == self.app else "dmg"))
            if path == self.dmg:
                self.dmg.write_bytes(self.dmg.read_bytes() + b" stapled ticket")

        def verify(*args):
            event("verify-distribution")
            self.assertFalse(self.dmg.with_suffix(".dmg.sha256").exists())

        for name, replacement in (("build_app", app), ("build_dmg", dmg), ("run", run)):
            mocked = patch.object(build_macos, name, side_effect=replacement)
            self.addCleanup(mocked.stop)
            setattr(self, name, mocked.start())
        for name, replacement in (
            ("verify_developer_id", lambda path: event("verify-id-" + ("app" if path == self.app else "dmg"))),
            ("submit", lambda path, **kwargs: event("submit-" + kwargs["label"])),
            ("staple", staple), ("verify_distribution", verify),
        ):
            mocked = patch.object(notarize_macos, name, side_effect=replacement)
            self.addCleanup(mocked.stop)
            mocked.start()

    def build(self, **options):
        return build_macos.build_distribution(self.root / "source.zip", self.root,
                                              sign_identity="Developer ID Application: CapForge (TESTTEAM)",
                                              sign_keychain=self.root / "signing.keychain-db",
                                              notary_profile="capforge-notary", **options)

    def test_staples_before_building_dmg_and_checksums_final_bytes(self):
        self.assertEqual(self.build(), (self.app, self.dmg))
        self.assertEqual(self.events, [
            "build-app", "verify-id-app", "archive-app", "submit-app", "staple-app",
            "build-dmg", "sign-dmg", "verify-id-dmg", "submit-dmg", "staple-dmg", "verify-distribution"
        ])
        expected = hashlib.sha256(b"disk image stapled ticket").hexdigest()
        self.assertEqual(self.dmg.with_suffix(".dmg.sha256").read_text(), expected + "  " + self.dmg.name + "\n")
        command = self.run.call_args.args
        self.assertIn("--timestamp", command)
        self.assertEqual(command[command.index("--identifier") + 1], "com.capforge.app.dmg")
        self.assertEqual(command[command.index("--keychain") + 1], self.root / "signing.keychain-db")

    def test_app_failure_stops_before_dmg_or_checksum(self):
        self.failure = "submit-app"
        with self.assertRaisesRegex(RuntimeError, "submit-app"):
            self.build()
        self.assertNotIn("staple-app", self.events)
        self.assertFalse(self.dmg.exists())
        self.assertFalse(self.dmg.with_suffix(".dmg.sha256").exists())

    def test_dmg_rejection_never_staples_or_writes_checksum(self):
        self.failure = "submit-dmg"
        with self.assertRaisesRegex(RuntimeError, "submit-dmg"):
            self.build()
        self.assertNotIn("staple-dmg", self.events)
        self.assertFalse(self.dmg.with_suffix(".dmg.sha256").exists())

    def test_gatekeeper_failure_never_writes_checksum(self):
        self.failure = "verify-distribution"
        with self.assertRaisesRegex(RuntimeError, "verify-distribution"):
            self.build()
        self.assertFalse(self.dmg.with_suffix(".dmg.sha256").exists())

    def test_notarized_app_only_still_gets_distribution_checks(self):
        self.assertEqual(self.build(skip_dmg=True), (self.app, None))
        self.assertEqual(self.events[-2:], ["staple-app", "verify-distribution"])
        self.assertNotIn("build-dmg", self.events)

    def test_notarization_rejects_adhoc_before_build(self):
        for identity in ("-", "", " "):
            with self.subTest(identity=identity), self.assertRaisesRegex(ValueError, "Developer ID"):
                build_macos.build_distribution(self.root / "source.zip", self.root,
                                              sign_identity=identity, notary_profile="capforge-notary")
        self.build_app.assert_not_called()

    def test_notary_keychain_without_profile_fails_before_build(self):
        with self.assertRaisesRegex(ValueError, "requires --notary-profile"):
            build_macos.build_distribution(self.root / "source.zip", self.root, notary_keychain=self.root / "keys")
        self.build_app.assert_not_called()

    def test_preview_still_builds_without_apple_services(self):
        build_macos.build_distribution(self.root / "source.zip", self.root)
        self.assertEqual(self.events, ["build-app", "build-dmg"])
        self.assertTrue(self.dmg.with_suffix(".dmg.sha256").is_file())


class TrustVerificationTests(unittest.TestCase):
    def test_final_checks_require_certificate_ticket_and_gatekeeper(self):
        app, dmg = Path("CapForge.app"), Path("CapForge.dmg")
        with patch.object(notarize_macos, "run") as run, patch.object(Path, "is_file", return_value=True):
            notarize_macos.verify_distribution(app, dmg)
        commands = [call.args for call in run.call_args_list]
        self.assertEqual(sum("--test-requirement" in command for command in commands), 2)
        self.assertIn(("xcrun", "stapler", "validate", app), commands)
        self.assertIn(("xcrun", "stapler", "validate", dmg), commands)
        self.assertIn(("/usr/bin/syspolicy_check", "distribution", app), commands)
        self.assertIn(("/usr/sbin/spctl", "--assess", "--type", "execute", "--verbose=2", app), commands)
        self.assertIn(("/usr/sbin/spctl", "--assess", "--type", "open", "--context", "context:primary-signature", "--verbose=2", dmg), commands)


if __name__ == "__main__":
    unittest.main()
