"""Validate imported documents before regrouping; never silently invent timing."""
from __future__ import annotations

import math
from copy import deepcopy


def validate_document(value: dict) -> dict:
    document = deepcopy(value)
    words, captions = document.get("words"), document.get("captions")
    if not isinstance(words, list) or not words or len(words) > 20000:
        raise ValueError("A transcript needs 1–20,000 timed words.")
    if not isinstance(captions, list) or not captions or len(captions) > 10000:
        raise ValueError("A transcript needs caption groups.")
    by_id, previous = {}, -1

    def number(value):
        return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)

    for word in words:
        if not isinstance(word, dict):
            raise ValueError("Each word must be an object.")
        wid, text = word.get("id"), word.get("text")
        start, end = word.get("start"), word.get("end")
        if type(wid) is not int or wid < 0 or wid in by_id:
            raise ValueError("Word IDs must be unique non-negative integers.")
        if not isinstance(text, str) or not text.strip() or len(text) > 200 or "\n" in text or "\r" in text:
            raise ValueError("Each word needs non-empty text, up to 200 characters.")
        if not number(start) or not number(end) or start < 0 or end <= start or start < previous:
            raise ValueError("Word timings must be ordered positive intervals.")
        punctuation = word.get("punctuationAfter", "")
        if not isinstance(punctuation, str) or len(punctuation) > 16:
            raise ValueError("Punctuation must be a short string.")
        word["punctuationAfter"] = punctuation
        previous, by_id[wid] = start, word
    used, caption_ids, previous = set(), set(), -1
    for caption in captions:
        if not isinstance(caption, dict):
            raise ValueError("Each caption must be an object.")
        start, end, cid = caption.get("start"), caption.get("end"), caption.get("id")
        if type(cid) is not int or cid < 0 or cid in caption_ids:
            raise ValueError("Caption IDs must be unique integers.")
        caption_ids.add(cid)
        if not number(start) or not number(end) or start < 0 or end <= start or start < previous:
            raise ValueError("Caption intervals must be ordered and must not overlap.")
        ids = caption.get("wordIds")
        if not isinstance(ids, list) or not ids or len(ids) > 100:
            raise ValueError("A caption needs between 1 and 100 word references.")
        last = -1
        for wid in ids:
            if type(wid) is not int or wid not in by_id or wid in used:
                raise ValueError("Caption word references must be unique and valid.")
            word = by_id[wid]
            if word["start"] < last or word["start"] < start - 0.001 or word["end"] > end + 0.001:
                raise ValueError("Words must be ordered and inside their caption intervals.")
            last = word["start"]
            used.add(wid)
        caption["text"] = " ".join(by_id[wid]["text"] + by_id[wid]["punctuationAfter"] for wid in ids)
        previous = end
    if len(used) != len(words):
        raise ValueError("Every word must belong to a caption.")
    end = max(words[-1]["end"], captions[-1]["end"])
    duration = document.get("duration")
    document["duration"] = duration if number(duration) and duration >= end else end
    if document["duration"] > 86400:
        raise ValueError("Split media longer than 24 hours into shorter clips.")
    return document
