"""Provider output -> normalized Word list.

Rules (AGENTS.md):
- Keep Georgian Unicode intact. Never transliterate.
- Skip spacing / audio-event tokens; never assign them word IDs.
- Punctuation returned as separate tokens is merged into the
  previous word's `punctuationAfter`.
- Trailing punctuation attached to a word is split off into
  `punctuationAfter` so grouping can detect sentence ends.
"""
from __future__ import annotations

from typing import List, Optional

from services.models import Word

SENTENCE_END = ".?!…"
PUNCT_CHARS = ".,!?;:…\"'«»“”‘’()[]"


def split_trailing_punctuation(text: str):
    """'ხარ?' -> ('ხარ', '?'). A punctuation-only token -> ('', token)."""
    core = text
    punct = ""
    while core and core[-1] in PUNCT_CHARS:
        punct = core[-1] + punct
        core = core[:-1]
    if not core:
        return "", punct
    return core, punct


def words_from_tokens(tokens: List[dict]) -> List[Word]:
    """Token stream (ElevenLabs style) -> Words.

    Token: {text, start, end, type?, speaker?, confidence?}
    type "spacing" / "audio_event" tokens are skipped.
    """
    words: List[Word] = []
    for t in tokens:
        ttype = t.get("type", "word")
        if ttype in ("spacing", "audio_event"):
            continue
        text = (t.get("text") or "").strip()
        if not text:
            continue
        core, punct = split_trailing_punctuation(text)
        if not core:
            # punctuation-only token: merge into previous word
            if words:
                words[-1].punctuationAfter += punct
            continue
        words.append(
            Word(
                id=len(words),
                text=core,
                start=float(t.get("start", 0.0)),
                end=float(t.get("end", 0.0)),
                confidence=float(t.get("confidence", 1.0) or 1.0),
                speaker=t.get("speaker"),
                punctuationAfter=punct,
            )
        )
    return words


def words_from_simple(
    items: List[dict],
    text_key: str = "text",
    start_key: str = "start",
    end_key: str = "end",
    confidence_key: str = "confidence",
    speaker_key: Optional[str] = None,
    time_scale: float = 1.0,
) -> List[Word]:
    """Flat word list (OpenAI, Gladia, AssemblyAI, Azure...) -> Words.

    time_scale converts provider units to seconds (0.001 for ms).
    """
    words: List[Word] = []
    for it in items:
        text = (it.get(text_key) or "").strip()
        if not text:
            continue
        core, punct = split_trailing_punctuation(text)
        if not core:
            if words:
                words[-1].punctuationAfter += punct
            continue
        conf = it.get(confidence_key)
        words.append(
            Word(
                id=len(words),
                text=core,
                start=round(float(it.get(start_key, 0.0)) * time_scale, 4),
                end=round(float(it.get(end_key, 0.0)) * time_scale, 4),
                confidence=float(conf) if conf is not None else 1.0,
                speaker=it.get(speaker_key) if speaker_key else None,
                punctuationAfter=punct,
            )
        )
    return words


def normalize_elevenlabs(raw: dict) -> List[Word]:
    tokens = [
        {
            "text": w.get("text", ""),
            "start": w.get("start", 0.0),
            "end": w.get("end", 0.0),
            "type": w.get("type", "word"),
            "speaker": w.get("speaker_id"),
        }
        for w in raw.get("words", [])
    ]
    return words_from_tokens(tokens)


def normalize_openai_verbose(raw: dict) -> List[Word]:
    return words_from_simple(raw.get("words", []), text_key="word")


def estimate_words_from_text(text: str, start: float, end: float, confidence: float = 0.3) -> List[Word]:
    """Fallback when a provider returns text without word timings.

    Distributes time proportionally to character length. Marked low
    confidence so the UI can warn that timings are estimated.
    """
    parts = [p for p in text.split() if p]
    if not parts:
        return []
    total_chars = sum(len(p) + 1 for p in parts)
    span = max(end - start, 0.01)
    words: List[Word] = []
    cursor = start
    for p in parts:
        w_dur = span * (len(p) + 1) / total_chars
        core, punct = split_trailing_punctuation(p)
        if not core:
            if words:
                words[-1].punctuationAfter += punct
                words[-1].end = round(cursor + w_dur, 4)
            cursor += w_dur
            continue
        words.append(
            Word(
                id=len(words),
                text=core,
                start=round(cursor, 4),
                end=round(cursor + w_dur, 4),
                confidence=confidence,
                punctuationAfter=punct,
            )
        )
        cursor += w_dur
    return words
