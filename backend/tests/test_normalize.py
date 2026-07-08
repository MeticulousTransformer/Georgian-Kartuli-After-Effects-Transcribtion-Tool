"""Normalization tests (unittest + pytest compatible)."""
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from services.grouping import group_words
from services.models import build_document
from services.normalize import (
    estimate_words_from_text,
    normalize_elevenlabs,
    normalize_openai_verbose,
    split_trailing_punctuation,
    words_from_simple,
)

FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures")


def load_fixture(name):
    with open(os.path.join(FIXTURES, name), encoding="utf-8") as f:
        return json.load(f)


class TestSplitPunctuation(unittest.TestCase):
    def test_georgian_question(self):
        self.assertEqual(split_trailing_punctuation("ხარ?"), ("ხარ", "?"))

    def test_no_punct(self):
        self.assertEqual(split_trailing_punctuation("გამარჯობა"), ("გამარჯობა", ""))

    def test_punct_only(self):
        self.assertEqual(split_trailing_punctuation("..."), ("", "..."))

    def test_multi_punct(self):
        self.assertEqual(split_trailing_punctuation("ვარ?!"), ("ვარ", "?!"))


class TestElevenLabsNormalization(unittest.TestCase):
    def setUp(self):
        self.raw = load_fixture("provider_elevenlabs_raw.json")
        self.words = normalize_elevenlabs(self.raw)

    def test_spacing_and_audio_events_skipped(self):
        self.assertEqual(len(self.words), 5)

    def test_ids_sequential(self):
        self.assertEqual([w.id for w in self.words], [0, 1, 2, 3, 4])

    def test_georgian_unicode_preserved(self):
        self.assertEqual(self.words[0].text, "გამარჯობა")

    def test_attached_punct_split(self):
        self.assertEqual(self.words[2].text, "ხარ")
        self.assertEqual(self.words[2].punctuationAfter, "?")

    def test_separate_punct_token_merged(self):
        # trailing "." token merged into "ვარ"
        self.assertEqual(self.words[4].text, "ვარ")
        self.assertEqual(self.words[4].punctuationAfter, ".")

    def test_full_pipeline_grouping(self):
        captions = group_words(self.words)
        self.assertEqual(len(captions), 2)
        self.assertEqual(captions[0].text, "გამარჯობა როგორ ხარ?")
        self.assertEqual(captions[1].text, "კარგად ვარ.")


class TestOpenAINormalization(unittest.TestCase):
    def test_verbose_json_words(self):
        raw = load_fixture("provider_openai_whisper_raw.json")
        words = normalize_openai_verbose(raw)
        self.assertEqual(len(words), 5)
        self.assertEqual(words[2].text, "ხარ")
        self.assertEqual(words[2].punctuationAfter, "?")
        self.assertEqual(words[4].punctuationAfter, ".")


class TestSimpleWords(unittest.TestCase):
    def test_ms_time_scale(self):
        words = words_from_simple(
            [{"text": "hello", "start": 100, "end": 500}], time_scale=0.001
        )
        self.assertAlmostEqual(words[0].start, 0.1)
        self.assertAlmostEqual(words[0].end, 0.5)


class TestEstimatedWords(unittest.TestCase):
    def test_estimate_marks_low_confidence(self):
        words = estimate_words_from_text("გამარჯობა როგორ ხარ?", 0.0, 3.0)
        self.assertEqual(len(words), 3)
        self.assertTrue(all(w.confidence <= 0.3 for w in words))
        self.assertAlmostEqual(words[0].start, 0.0)
        self.assertAlmostEqual(words[-1].end, 3.0, places=2)
        # monotonic, non-overlapping
        for a, b in zip(words, words[1:]):
            self.assertLessEqual(a.end, b.start + 1e-6)


class TestDocument(unittest.TestCase):
    def test_document_shape_matches_fixture(self):
        fixture = load_fixture("georgian_short.json")
        raw = load_fixture("provider_elevenlabs_raw.json")
        words = normalize_elevenlabs(raw)
        captions = group_words(words)
        doc = build_document("/example/georgian.mp4", "ka-GE", "elevenlabs",
                             2.85, words, captions)
        self.assertEqual(set(doc.keys()), set(fixture.keys()))
        self.assertEqual(set(doc["words"][0].keys()),
                         set(fixture["words"][0].keys()))
        self.assertEqual(set(doc["captions"][0].keys()),
                         set(fixture["captions"][0].keys()))

    def test_duration_fallback_from_words(self):
        raw = load_fixture("provider_elevenlabs_raw.json")
        words = normalize_elevenlabs(raw)
        doc = build_document("/x.mp4", "ka-GE", "elevenlabs", None, words, [])
        # last speech word ends at 2.8; merged punct token timing is ignored
        self.assertAlmostEqual(doc["duration"], 2.8, places=2)


if __name__ == "__main__":
    unittest.main()
