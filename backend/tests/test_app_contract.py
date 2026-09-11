"""Backend request-contract tests."""
import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import GroupingModel
from services.grouping import GroupingOptions


class TestGroupingRequestContract(unittest.TestCase):
    def test_sentence_controls_reach_grouping_options(self):
        request_grouping = GroupingModel(
            minWords=3,
            maxWords=5,
            minCaptionDuration=0.75,
            maxCaptionDuration=4.25,
            removeCommasAndPeriods=True,
        )

        options = GroupingOptions.from_dict(request_grouping.model_dump())

        self.assertEqual(options.minWords, 3)
        self.assertEqual(options.maxWords, 5)
        self.assertEqual(options.minCaptionDuration, 0.75)
        self.assertEqual(options.maxCaptionDuration, 4.25)
        self.assertTrue(options.removeCommasAndPeriods)


if __name__ == "__main__":
    unittest.main()
