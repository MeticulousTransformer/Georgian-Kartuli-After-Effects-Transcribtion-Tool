"""Word -> caption chunk grouping (AGENTS.md rules).

New caption starts when:
  - current caption reached maxWords
  - pause between words exceeds pauseBreakSeconds
  - previous word ends a sentence (. ? ! …)
  - caption duration would exceed maxCaptionDuration
  - caption text would exceed maxChars
Minimum word-count and duration targets rebalance chunks when hard limits allow.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional

from services.models import Caption, Word

SENTENCE_END = set(".?!…")


@dataclass
class GroupingOptions:
    minWords: int = 2
    maxWords: int = 4
    maxChars: int = 42
    pauseBreakSeconds: float = 0.55
    minCaptionDuration: float = 0.5
    maxCaptionDuration: float = 3.5
    removeCommasAndPeriods: bool = False

    @classmethod
    def from_dict(cls, d: Optional[dict]) -> "GroupingOptions":
        d = d or {}
        opts = cls(
            minWords=int(d.get("minWords", 2)),
            maxWords=int(d.get("maxWords", 4)),
            maxChars=int(d.get("maxChars", 42)),
            pauseBreakSeconds=float(d.get("pauseBreakSeconds", 0.55)),
            minCaptionDuration=float(d.get("minCaptionDuration", 0.5)),
            maxCaptionDuration=float(d.get("maxCaptionDuration", 3.5)),
            removeCommasAndPeriods=bool(d.get("removeCommasAndPeriods", False)),
        )
        opts.maxWords = max(1, min(6, opts.maxWords))
        opts.minWords = max(1, min(opts.maxWords, opts.minWords))
        return opts


def caption_text(words: List[Word]) -> str:
    return " ".join(w.display_text() for w in words)


def ends_sentence(word: Word) -> bool:
    return any(ch in SENTENCE_END for ch in word.punctuationAfter)


def group_words(words: List[Word], opts: Optional[GroupingOptions] = None) -> List[Caption]:
    opts = opts or GroupingOptions()
    chunks: List[List[Word]] = []
    current: List[Word] = []

    def flush():
        nonlocal current
        if not current:
            return
        chunks.append(current)
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

    def fits_max(candidate: List[Word]) -> bool:
        return (
            len(candidate) <= opts.maxWords
            and candidate[-1].end - candidate[0].start <= opts.maxCaptionDuration
            and len(caption_text(candidate)) <= opts.maxChars
        )

    def meets_min(candidate: List[Word]) -> bool:
        return (
            len(candidate) >= opts.minWords
            and candidate[-1].end - candidate[0].start >= opts.minCaptionDuration
        )

    for i in range(len(chunks) - 1, 0, -1):
        previous = chunks[i - 1]
        chunk = chunks[i]
        hard_boundary = (
            ends_sentence(previous[-1])
            or chunk[0].start - previous[-1].end > opts.pauseBreakSeconds
        )
        if hard_boundary:
            continue
        while not meets_min(chunk) and len(previous) > 1:
            candidate = [previous[-1]] + chunk
            if not fits_max(candidate) or not meets_min(previous[:-1]):
                break
            previous.pop()
            chunk.insert(0, candidate[0])

    captions = [
        Caption(
            id=i,
            text=caption_text(chunk),
            start=chunk[0].start,
            end=chunk[-1].end,
            wordIds=[w.id for w in chunk],
            lineIndex=0,
        )
        for i, chunk in enumerate(chunks)
    ]

    if opts.removeCommasAndPeriods:
        for word in words:
            word.punctuationAfter = (
                word.punctuationAfter.replace(",", "").replace(".", "")
            )
        for caption, chunk in zip(captions, chunks):
            caption.text = caption_text(chunk)

    return captions
