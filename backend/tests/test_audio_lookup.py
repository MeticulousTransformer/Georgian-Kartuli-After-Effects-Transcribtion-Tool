import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from services import audio_extract


class TestBundledAudio(unittest.TestCase):
    def test_bundled_binary_is_used_when_ffmpeg_is_not_on_path(self):
        bundled=SimpleNamespace(get_ffmpeg_exe=lambda: "/private/capforge/ffmpeg")
        with patch.object(audio_extract.shutil,"which",return_value=None), patch.object(audio_extract,"FFMPEG_CANDIDATES",[]), patch.dict(sys.modules,{"imageio_ffmpeg":bundled}):
            self.assertEqual(audio_extract.find_ffmpeg(),"/private/capforge/ffmpeg")

    def test_missing_binary_offers_installer_repair(self):
        with patch.object(audio_extract.shutil,"which",return_value=None), patch.object(audio_extract,"FFMPEG_CANDIDATES",[]), patch.dict(sys.modules,{"imageio_ffmpeg":None}):
            self.assertIsNone(audio_extract.find_ffmpeg())
            with self.assertRaisesRegex(RuntimeError,"CapForge installer"):
                audio_extract.extract_audio("missing.mp4","exports")
