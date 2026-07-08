"""Grouping tests (unittest + pytest compatible)."""
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from services.grouping import GroupingOptions, group_words
from services.models import Word


def w(i, text, start, end, punct=""):
    return Word(id=i, text=text, start=start, end=end, punctuationAfter=punct)


class TestGrouping(unittest.TestCase):
    def test_max_words_split(self):
        words = [w(i, f"სიტყვა{i}", i * 0.3, i * 0.3 + 0.25) for i in range(6)]
        captions = group_words(words, GroupingOptions(maxWords=4))
        self.assertEqual(len(captions), 2)
        self.assertEqual(captions[0].wordIds, [0, 1, 2, 3])
        self.assertEqual(captions[1].wordIds, [4, 5])

    def test_pause_split(self):
        words = [
            w(0, "გამარჯობა", 0.0, 0.4),
            w(1, "როგორ", 0.45, 0.8),
            w(2, "კარგად", 2.0, 2.4),  # pause 1.2s > 0.55s
        ]
        captions = group_words(words)
        self.assertEqual(len(captions), 2)
        self.assertEqual(captions[1].wordIds, [2])

    def test_punctuation_split(self):
        words = [
            w(0, "ხარ", 0.0, 0.3, punct="?"),
            w(1, "კარგად", 0.35, 0.7),
        ]
        captions = group_words(words)
        self.assertEqual(len(captions), 2)
        self.assertEqual(captions[0].text, "ხარ?")

    def test_ellipsis_split(self):
        words = [w(0, "კარგი", 0.0, 0.3, punct="…"), w(1, "მერე", 0.35, 0.7)]
        captions = group_words(words)
        self.assertEqual(len(captions), 2)

    def test_max_duration_split(self):
        words = [
            w(0, "ერთი", 0.0, 1.5),
            w(1, "ორი", 1.6, 3.0),
            w(2, "სამი", 3.1, 4.5),  # duration would be 4.5s > 3.5s
        ]
        captions = group_words(words, GroupingOptions(pauseBreakSeconds=1.0))
        self.assertEqual(len(captions), 2)
        self.assertEqual(captions[0].wordIds, [0, 1])

    def test_max_chars_split(self):
        words = [
            w(0, "აააააააააააააააააააა", 0.0, 0.5),   # 20 chars
            w(1, "ბბბბბბბბბბბბბბბბბბბბ", 0.55, 1.0),  # +1 space +20 = 41 ok
            w(2, "გგგ", 1.05, 1.4),                    # 45 > 42 -> split
        ]
        captions = group_words(words)
        self.assertEqual(len(captions), 2)
        self.assertEqual(captions[1].wordIds, [2])

    def test_min_duration_extension(self):
        words = [w(0, "ჰო", 0.0, 0.2), w(1, "კაი", 2.0, 2.5)]
        captions = group_words(words)
        self.assertEqual(len(captions), 2)
        self.assertAlmostEqual(captions[0].end, 0.5, places=3)

    def test_min_duration_no_collision(self):
        words = [w(0, "ჰო", 0.0, 0.2), w(1, "კაი", 0.3, 3.0)]
        captions = group_words(words, GroupingOptions(pauseBreakSeconds=0.05))
        self.assertEqual(len(captions), 2)
        self.assertLessEqual(captions[0].end, captions[1].start)

    def test_georgian_unicode_intact(self):
        words = [w(0, "გამარჯობა", 0.0, 0.4), w(1, "საქართველო", 0.45, 1.0)]
        captions = group_words(words)
        self.assertEqual(captions[0].text, "გამარჯობა საქართველო")

    def test_max_words_clamped(self):
        opts = GroupingOptions.from_dict({"maxWords": 99})
        self.assertEqual(opts.maxWords, 6)
        opts = GroupingOptions.from_dict({"maxWords": 0})
        self.assertEqual(opts.maxWords, 1)

    def test_empty_input(self):
        self.assertEqual(group_words([]), [])


if __name__ == "__main__":
    unittest.main()
