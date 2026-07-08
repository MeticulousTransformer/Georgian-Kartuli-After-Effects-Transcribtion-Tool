"""Microsoft Azure AI Speech — fast transcription REST API.

Supports Georgian (ka-GE) with word-level timestamps.
Env: AZURE_SPEECH_KEY, AZURE_SPEECH_REGION (e.g. westeurope)
"""
from __future__ import annotations

import json
import os

import requests

from providers.base import ASRProvider, ProviderError, ProviderResult, lang_bcp47
from services.normalize import words_from_simple

API_VERSION = "2024-11-15"


class AzureSpeechProvider(ASRProvider):
    id = "azure_speech"
    label = "Azure AI Speech"
    type = "cloud"
    api_key_env = "AZURE_SPEECH_KEY"

    def availability(self):
        if not os.environ.get("AZURE_SPEECH_KEY"):
            return False, "missing AZURE_SPEECH_KEY"
        if not os.environ.get("AZURE_SPEECH_REGION"):
            return False, "missing AZURE_SPEECH_REGION"
        return True, None

    def transcribe(self, audio_path: str, language: str, options: dict) -> ProviderResult:
        ok, detail = self.availability()
        if not ok:
            raise ProviderError(f"Provider unavailable: {detail}.")
        key = os.environ["AZURE_SPEECH_KEY"]
        region = os.environ["AZURE_SPEECH_REGION"]
        url = (
            f"https://{region}.api.cognitive.microsoft.com/speechtotext/"
            f"transcriptions:transcribe?api-version={API_VERSION}"
        )
        lang = lang_bcp47(language)
        definition = {"locales": [lang]} if lang else {}

        with open(audio_path, "rb") as f:
            resp = requests.post(
                url,
                headers={"Ocp-Apim-Subscription-Key": key},
                files={
                    "audio": (os.path.basename(audio_path), f, "audio/wav"),
                    "definition": (None, json.dumps(definition), "application/json"),
                },
                timeout=900,
            )
        if not resp.ok:
            raise ProviderError(f"Azure Speech error {resp.status_code}: {resp.text[:500]}")
        raw = resp.json()

        raw_words = []
        for phrase in raw.get("phrases", []):
            conf = phrase.get("confidence", 1.0)
            for w in phrase.get("words", []):
                start_ms = w.get("offsetMilliseconds", 0)
                raw_words.append({
                    "text": w.get("text", ""),
                    "start": start_ms,
                    "end": start_ms + w.get("durationMilliseconds", 0),
                    "confidence": conf,
                })
        words = words_from_simple(raw_words, time_scale=0.001)
        if not words:
            raise ProviderError(
                "Azure returned no word timestamps. Check locale support "
                f"for '{lang}' in region '{region}'."
            )
        duration = raw.get("durationMilliseconds")
        return ProviderResult(
            raw=raw, words=words,
            duration=duration / 1000.0 if duration else None,
            timing_quality="word",
        )
