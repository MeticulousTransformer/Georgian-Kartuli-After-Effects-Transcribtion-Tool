import json
import sys
import tempfile
import unittest
import os
import subprocess
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from deployment import EXTENSION_ID, install


class TestInstaller(unittest.TestCase):
    def test_install_and_update_preserve_user_keys_outputs_and_environment(self):
        with tempfile.TemporaryDirectory() as folder:
            base = Path(folder); root, extensions = base/"runtime", base/"extensions"
            install(root, extensions, dependencies=False, progress=lambda _: None)
            self.assertFalse((root/"backend/.venv").exists())
            self.assertFalse((root/"backend/.env").exists())
            self.assertFalse((root/"backend/.local-token").exists())
            (root/"backend/.env").write_text("OPENAI_API_KEY=test-user-key\n",encoding="utf-8")
            (root/"exports").mkdir(); (root/"exports/user.json").write_text("keep")
            (root/".venv").mkdir(); (root/".venv/keep").write_text("keep")
            install(root, extensions, dependencies=False, progress=lambda _: None)
            self.assertIn("test-user-key", (root/"backend/.env").read_text())
            self.assertEqual((root/"exports/user.json").read_text(),"keep")
            self.assertTrue((root/".venv/keep").exists())
            self.assertTrue((root/"installer/bootstrap_windows.ps1").exists())
            self.assertTrue((root/"panel/index.html").exists())
            extension = extensions/EXTENSION_ID
            self.assertTrue((extension/"CSXS/manifest.xml").exists())
            self.assertTrue((extension/"json2.js").exists())
            self.assertEqual(json.loads((extension/"install.json").read_text())["runtimeRoot"],str(root.resolve()))
            self.assertEqual([p.name for p in extensions.iterdir()],[EXTENSION_ID])
            self.assertTrue(list((root/"backups").glob("*/extension")))

    def test_refuses_unrelated_runtime_or_extension_destinations(self):
        with tempfile.TemporaryDirectory() as folder:
            base = Path(folder); root, extensions = base/"runtime", base/"extensions"
            root.mkdir(); (root/"user.txt").write_text("keep")
            with self.assertRaises(ValueError): install(root, extensions, dependencies=False)
            self.assertEqual((root/"user.txt").read_text(),"keep")
            unrelated = extensions/EXTENSION_ID; unrelated.mkdir(parents=True)
            (unrelated/"user.txt").write_text("keep")
            with self.assertRaises(ValueError): install(base/"new-runtime", extensions, dependencies=False)
            self.assertEqual((unrelated/"user.txt").read_text(),"keep")

    def test_failure_restores_previous_installation(self):
        with tempfile.TemporaryDirectory() as folder:
            base = Path(folder); root, extensions = base/"runtime", base/"extensions"
            install(root, extensions, dependencies=False, progress=lambda _:None)
            original = (root/"ae/KartuliCaptionForge.jsx").read_bytes()
            (root/"backend/.env").write_text("OPENAI_API_KEY=preserve\n")
            with patch("deployment.enable_unsigned", side_effect=RuntimeError("injected failure")):
                with self.assertRaises(RuntimeError): install(root, extensions, dependencies=False, unsigned=True, progress=lambda _:None)
            self.assertEqual((root/"ae/KartuliCaptionForge.jsx").read_bytes(),original)
            self.assertIn("preserve", (root/"backend/.env").read_text())
            self.assertTrue((extensions/EXTENSION_ID/"CSXS/manifest.xml").exists())

    def test_rename_updates_owned_legacy_install_without_losing_user_data(self):
        from environment import data_root
        with tempfile.TemporaryDirectory() as folder:
            base = Path(folder); root = base/"Kartuli Caption Forge"; extensions = base/"extensions"
            install(root,extensions,dependencies=False,progress=lambda _:None)
            for marker in (root/".kcf-install.json",extensions/EXTENSION_ID/"install.json"):
                data=json.loads(marker.read_text()); data["tool"]="Kartuli Caption Forge"
                marker.write_text(json.dumps(data),encoding="utf-8")
            (root/"backend/.env").write_text("OPENAI_API_KEY=legacy-user-key\n")
            (root/".runtime").mkdir(); (root/".runtime/keep").write_text("private-runtime")
            with patch("environment.sys.platform","win32"), patch.dict(os.environ,{"LOCALAPPDATA":str(base)}):
                self.assertEqual(data_root(),root)
            install(root,extensions,dependencies=False,progress=lambda _:None)
            self.assertEqual(json.loads((root/".kcf-install.json").read_text())["tool"],"CapForge")
            self.assertIn("legacy-user-key",(root/"backend/.env").read_text())
            self.assertEqual((root/".runtime/keep").read_text(),"private-runtime")

    def test_broken_earlier_python_is_backed_up_and_restored_if_repair_fails(self):
        for fail in (False,True):
            with self.subTest(fail=fail), tempfile.TemporaryDirectory() as folder:
                base=Path(folder); root=base/"runtime"; extensions=base/"extensions"
                install(root,extensions,dependencies=False,progress=lambda _:None)
                interpreter=root/".venv"/("Scripts/python.exe" if sys.platform=="win32" else "bin/python")
                interpreter.parent.mkdir(parents=True); interpreter.write_text("broken base interpreter")
                (root/".venv/user-package.txt").write_text("preserve")
                def run(arguments,**kwargs):
                    if arguments[1:3]==["-m","venv"]:
                        interpreter.parent.mkdir(parents=True); interpreter.write_text("private runtime")
                    broken = arguments[1:3]==["-I","-c"] and arguments[-1]=="import sys, pip"
                    failed = fail and arguments[1:3]==["-m","pip"]
                    return subprocess.CompletedProcess(arguments,1 if broken or failed else 0,"","injected package failure" if failed else "")
                with patch("deployment.subprocess.run",side_effect=run):
                    if fail:
                        with self.assertRaises(RuntimeError): install(root,extensions,progress=lambda _:None)
                        self.assertEqual(interpreter.read_text(),"broken base interpreter")
                        self.assertEqual((root/".venv/user-package.txt").read_text(),"preserve")
                    else:
                        install(root,extensions,progress=lambda _:None)
                        self.assertEqual(interpreter.read_text(),"private runtime")
                        backups=list((root/"backups").glob("*/environment/user-package.txt"))
                        self.assertEqual(len(backups),1); self.assertEqual(backups[0].read_text(),"preserve")


if __name__ == "__main__": unittest.main()
