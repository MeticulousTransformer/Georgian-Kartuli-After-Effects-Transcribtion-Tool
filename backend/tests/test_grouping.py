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
    def test_min_words_rebalances_sentence_tail(self):
        words = [
            w(i, f"word{i}", i * 0.25, i * 0.25 + 0.2,
              punct="." if i == 4 else "")
            for i in range(5)
        ]
        original_times = [(word.start, word.end) for word in words]
        opts = GroupingOptions.from_dict({
            "minWords": 2,
            "maxWords": 4,
            "minCaptionDuration": 0,
        })

        captions = group_words(words, opts)

        self.assertEqual([c.wordIds for c in captions], [[0, 1, 2], [3, 4]])
        self.assertEqual([(word.start, word.end) for word in words], original_times)

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

    def test_min_duration_does_not_extend_real_caption_end(self):
        words = [w(0, "ჰო", 0.0, 0.2), w(1, "კაი", 2.0, 2.5)]
        captions = group_words(words)
        self.assertEqual(len(captions), 2)
        self.assertAlmostEqual(captions[0].end, 0.2, places=3)

    def test_min_duration_rebalances_using_real_word_span(self):
        words = [
            w(0, "one", 0.0, 0.3),
            w(1, "two", 0.31, 0.6),
            w(2, "three", 0.61, 0.9),
            w(3, "four", 0.91, 1.2),
            w(4, "five", 1.21, 1.35, punct="."),
        ]
        opts = GroupingOptions.from_dict({
            "minWords": 1,
            "maxWords": 4,
            "minCaptionDuration": 0.4,
        })

        captions = group_words(words, opts)

        self.assertEqual([c.wordIds for c in captions], [[0, 1, 2], [3, 4]])
        self.assertAlmostEqual(captions[1].start, 0.91, places=3)
        self.assertAlmostEqual(captions[1].end, 1.35, places=3)

    def test_remove_commas_and_periods_after_sentence_grouping(self):
        words = [
            w(0, "hello", 0.0, 0.2, punct=","),
            w(1, "world", 0.21, 0.4, punct="."),
            w(2, "next", 0.41, 0.6),
        ]
        opts = GroupingOptions.from_dict({
            "minWords": 1,
            "minCaptionDuration": 0,
            "removeCommasAndPeriods": True,
        })

        captions = group_words(words, opts)

        self.assertEqual([c.wordIds for c in captions], [[0, 1], [2]])
        self.assertEqual([word.punctuationAfter for word in words], ["", "", ""])
        self.assertEqual([c.text for c in captions], ["hello world", "next"])

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
