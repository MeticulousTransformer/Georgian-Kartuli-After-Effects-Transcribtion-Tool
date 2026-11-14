"""Final update archives retain the app ticket, identity and executable modes."""
import hashlib
import json
import os
from pathlib import Path
import stat
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import check_notarized_updates as checks
from notarize_macos import DEVELOPER_ID_REQUIREMENT
from package_release import REQUIRED


class NotarizedUpdateTests(unittest.TestCase):
    def setUp(self):
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        self.root = Path(folder.name)
        self.identity = {"version": "1.2.3", "commit": "a" * 40, "tag": "release-test"}
        environment = patch.dict(os.environ, {"GITHUB_SHA": self.identity["commit"],
                                            "CAPFORGE_RELEASE_TAG": self.identity["tag"]})
        environment.start()
        self.addCleanup(environment.stop)

    def archive(self, *, legacy=False, platform=None, payload=None, extra=None,
                damaged=False, executable=True):
        release = dict(self.identity)
        if not legacy:
            release["platform"] = platform or "macos"
        elif platform:
            release["platform"] = platform
        files = {name: b"fixture" for name in REQUIRED}
        files.update({
            "release.json": json.dumps(release).encode(),
            "CapForge.app/Contents/MacOS/CapForge": b"native executable",
            "CapForge.app/Contents/CodeResources": b"stapled ticket",
            "CapForge.app/Contents/Resources/payload/release.json": json.dumps(payload or self.identity).encode(),
            "CapForge.app/Contents/Resources/payload/installer/bootstrap_macos.sh": b"#!/bin/bash\n",
        })
        if extra:
            files.update(extra)
        manifest = [{"path": name, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
                    for name, data in files.items()]
        if damaged:
            files["CapForge.app/Contents/CodeResources"] = b"changed ticket"
        archive = self.root / ("legacy.zip" if legacy else "macos.zip")
        with zipfile.ZipFile(archive, "w") as package:
            for name, data in files.items():
                info = zipfile.ZipInfo("CapForge-1.2.3/" + name)
                info.create_system = 3
                mode = 0o755 if name.endswith((".sh", ".command")) or (executable and name == "CapForge.app/Contents/MacOS/CapForge") else 0o644
                info.external_attr = (stat.S_IFREG | mode) << 16
                package.writestr(info, data)
            package.writestr("CapForge-1.2.3/package-manifest.json", json.dumps(manifest))
        archive.with_suffix(".zip.sha256").write_text(hashlib.sha256(archive.read_bytes()).hexdigest() + "  " + archive.name + "\n")
        return archive

    def test_both_archives_verify_extracted_signature_ticket_and_gatekeeper(self):
        for legacy in (False, True):
            with self.subTest(legacy=legacy):
                calls = []

                def verify_command(command, **options):
                    calls.append(command)
                    app = Path(command[-1])
                    self.assertTrue(app.is_dir())
                    self.assertEqual((app / "Contents/CodeResources").read_bytes(), b"stapled ticket")
                    if os.name != "nt":
                        for relative in ("Contents/MacOS/CapForge", "Contents/Resources/payload/installer/bootstrap_macos.sh"):
                            self.assertEqual((app / relative).stat().st_mode & 0o777, 0o755)
                    self.assertTrue(options["check"])

                with patch("notarize_macos.subprocess.run", side_effect=verify_command):
                    identity = checks.check_update(self.archive(legacy=legacy), "1.2.3", legacy=legacy)
                self.assertEqual(identity["commit"], self.identity["commit"])
                self.assertEqual(calls[0][:-1], ["/usr/bin/codesign", "--verify", "--deep", "--strict",
                                              "--test-requirement", DEVELOPER_ID_REQUIREMENT])
                self.assertEqual(calls[1][:-1], ["xcrun", "stapler", "validate"])
                self.assertEqual(calls[2][:-1], ["/usr/sbin/spctl", "--assess", "--type", "execute", "--verbose=2"])
                self.assertFalse(Path(calls[0][-1]).exists())

    @patch("check_notarized_updates.verify_distribution")
    def test_checksum_or_manifest_damage_prevents_signature_checks(self, verify):
        archive = self.archive()
        archive.with_suffix(".zip.sha256").write_text("0" * 64)
        with self.assertRaisesRegex(ValueError, "checksum"):
            checks.check_update(archive, "1.2.3")
        with self.assertRaisesRegex(ValueError, "Damaged release component"):
            checks.check_update(self.archive(damaged=True), "1.2.3")
        verify.assert_not_called()

    @patch("check_notarized_updates.verify_distribution")
    def test_wrong_payload_identity_or_platform_is_rejected(self, verify):
        for key in ("version", "commit", "tag"):
            with self.subTest(key=key), self.assertRaisesRegex(ValueError, "wrong " + key):
                checks.check_update(self.archive(payload={**self.identity, key: "other"}), "1.2.3")
        for legacy in (False, True):
            with self.subTest(legacy=legacy), self.assertRaisesRegex(ValueError, "platform"):
                checks.check_update(self.archive(legacy=legacy, platform="windows"), "1.2.3", legacy=legacy)
        verify.assert_not_called()

    @patch("check_notarized_updates.verify_distribution")
    def test_missing_native_execute_bit_is_rejected(self, verify):
        with self.assertRaisesRegex(ValueError, "not executable"):
            checks.check_update(self.archive(executable=False), "1.2.3")
        verify.assert_not_called()

    @patch("check_notarized_updates.verify_distribution")
    def test_unsafe_or_aliased_paths_are_rejected(self, verify):
        for path in ("../../escape", "CapForge.app/./Contents/alias"):
            with self.subTest(path=path), self.assertRaisesRegex(ValueError, "Unsafe"):
                checks.check_update(self.archive(extra={path: b"unsafe"}), "1.2.3")
        verify.assert_not_called()

    def test_failed_signature_or_ticket_validation_blocks_success_and_cleans_up(self):
        for fail_at in ("/usr/bin/codesign", "xcrun", "/usr/sbin/spctl"):
            seen = []

            def fail(command, **options):
                seen.append(command)
                if command[0] == fail_at:
                    raise subprocess.CalledProcessError(1, command)

            with self.subTest(tool=fail_at), patch("notarize_macos.subprocess.run", side_effect=fail):
                with self.assertRaises(subprocess.CalledProcessError):
                    checks.check_update(self.archive(), "1.2.3")
                self.assertEqual(seen[-1][0], fail_at)
                self.assertFalse(Path(seen[-1][-1]).exists())


if __name__ == "__main__":
    unittest.main()
