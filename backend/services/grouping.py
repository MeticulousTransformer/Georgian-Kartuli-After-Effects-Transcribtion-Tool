"""Word -> caption chunk grouping (AGENTS.md rules).

New caption starts when:
  - current caption reached maxWords
  - pause between words exceeds pauseBreakSeconds
  - previous word ends a sentence (. ? ! …)
  - caption duration would exceed maxCaptionDuration
  - caption text would exceed maxChars
Captions shorter than minCaptionDuration get extended slightly
unless that collides with the next caption.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional

from services.models import Caption, Word

SENTENCE_END = set(".?!…")


@dataclass
class GroupingOptions:
    maxWords: int = 4
    maxChars: int = 42
    pauseBreakSeconds: float = 0.55
    minCaptionDuration: float = 0.5
    maxCaptionDuration: float = 3.5

    @classmethod
    def from_dict(cls, d: Optional[dict]) -> "GroupingOptions":
        d = d or {}
        opts = cls(
            maxWords=int(d.get("maxWords", 4)),
            maxChars=int(d.get("maxChars", 42)),
            pauseBreakSeconds=float(d.get("pauseBreakSeconds", 0.55)),
            minCaptionDuration=float(d.get("minCaptionDuration", 0.5)),
            maxCaptionDuration=float(d.get("maxCaptionDuration", 3.5)),
        )
        opts.maxWords = max(1, min(6, opts.maxWords))
        return opts


def caption_text(words: List[Word]) -> str:
    return " ".join(w.display_text() for w in words)


def ends_sentence(word: Word) -> bool:
    return any(ch in SENTENCE_END for ch in word.punctuationAfter)


def group_words(words: List[Word], opts: Optional[GroupingOptions] = None) -> List[Caption]:
    opts = opts or GroupingOptions()
    captions: List[Caption] = []
    current: List[Word] = []

    def flush():
        nonlocal current
        if not current:
            return
        captions.append(
            Caption(
                id=len(captions),
                text=caption_text(current),
                start=current[0].start,
                end=current[-1].end,
                wordIds=[w.id for w in current],
                lineIndex=0,
            )
        )
        current = []

    for w in words:
        if current:
            pause = w.start - current[-1].end
            duration = w.end - current[0].start
            if (
                len(current) >= opts.maxWords
                or pause > opts.pauseBreakSeconds
                or duration > opts.maxCaptionDuration
                or len(caption_text(current + [w])) > opts.maxChars
            ):
                flush()
        current.append(w)
        if ends_sentence(w):
            flush()
    flush()

    # Extend too-short captions without colliding with the next one.
    for i, c in enumerate(captions):
        if c.end - c.start < opts.minCaptionDuration:
            desired = c.start + opts.minCaptionDuration
            if i + 1 < len(captions):
                desired = min(desired, captions[i + 1].start - 0.01)
            c.end = max(c.end, round(desired, 4))
    return captions
