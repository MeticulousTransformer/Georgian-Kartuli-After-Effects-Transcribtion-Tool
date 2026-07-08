"""Google Cloud Speech-to-Text V2 (Chirp 3 -> Chirp 2 -> Chirp fallback).

Requires: pip install google-cloud-speech
Env: GOOGLE_APPLICATION_CREDENTIALS, GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_LOCATION
Note: sync recognize supports up to ~60s / 10MB audio.
"""
from __future__ import annotations

import os

from providers.base import ASRProvider, ProviderError, ProviderResult, lang_bcp47
from services.local_scan import module_available
from services.models import Word
from services.normalize import estimate_words_from_text, split_trailing_punctuation

MODEL_FALLBACK = ["chirp_3", "chirp_2", "chirp"]


class GoogleChirpProvider(ASRProvider):
    id = "google_chirp"
    label = "Google Chirp (Cloud STT v2)"
    type = "cloud"
    needs_api_key = True

    def availability(self):
        if not module_available("google.cloud.speech_v2"):
            return False, "pip install google-cloud-speech"
        if not os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
            return False, "missing GOOGLE_APPLICATION_CREDENTIALS"
        if not os.environ.get("GOOGLE_CLOUD_PROJECT"):
            return False, "missing GOOGLE_CLOUD_PROJECT"
        return True, None

    def transcribe(self, audio_path: str, language: str, options: dict) -> ProviderResult:
        ok, detail = self.availability()
        if not ok:
            raise ProviderError(f"Provider unavailable: {detail}.")
        from google.api_core.client_options import ClientOptions
        from google.cloud.speech_v2 import SpeechClient
        from google.cloud.speech_v2.types import cloud_speech

        options = options or {}
        project = os.environ["GOOGLE_CLOUD_PROJECT"]
        location = os.environ.get("GOOGLE_CLOUD_LOCATION", "eu")
        endpoint = None if location == "global" else f"{location}-speech.googleapis.com"
        client = SpeechClient(
            client_options=ClientOptions(api_endpoint=endpoint) if endpoint else None
        )

        with open(audio_path, "rb") as f:
            content = f.read()
        if len(content) > 10 * 1024 * 1024:
            raise ProviderError(
                "Audio too large for Google sync recognize (~60s / 10MB limit). "
                "Use ElevenLabs or a local Whisper provider for long files."
            )

        lang = lang_bcp47(language) or "auto"
        models = [options["model"]] if options.get("model") else MODEL_FALLBACK
        recognizer = f"projects/{project}/locations/{location}/recognizers/_"
        response = None
        used_model = None
        last_err = None
        for model in models:
            config = cloud_speech.RecognitionConfig(
                auto_decoding_config=cloud_speech.AutoDetectDecodingConfig(),
                language_codes=[lang],
                model=model,
                features=cloud_speech.RecognitionFeatures(
                    enable_word_time_offsets=True,
                    enable_automatic_punctuation=True,
                ),
            )
            try:
                response = client.recognize(
                    request=cloud_speech.RecognizeRequest(
                        recognizer=recognizer, config=config, content=content
                    )
                )
                used_model = model
                break
            except Exception as e:  # model not available in this location -> next
                last_err = e
        if response is None:
            raise ProviderError(f"Google Chirp failed for all models: {last_err}")

        words = []
        segments = []
        for result in response.results:
            if not result.alternatives:
                continue
            alt = result.alternatives[0]
            seg_end = (
                result.result_end_offset.total_seconds()
                if result.result_end_offset else 0.0
            )
            segments.append({"text": alt.transcript, "end": seg_end,
                             "confidence": alt.confidence})
            for w in alt.words:
                text = (w.word or "").strip()
                if not text:
                    continue
                core, punct = split_trailing_punctuation(text)
                if not core:
                    if words:
                        words[-1].punctuationAfter += punct
                    continue
                words.append(Word(
                    id=len(words), text=core,
                    start=w.start_offset.total_seconds() if w.start_offset else 0.0,
                    end=w.end_offset.total_seconds() if w.end_offset else 0.0,
                    confidence=w.confidence or alt.confidence or 1.0,
                    punctuationAfter=punct,
                ))

        raw = {"model": used_model, "location": location, "segments": segments,
               "wordCount": len(words)}

        if words:
            return ProviderResult(raw=raw, words=words, timing_quality="word")

        # Segment-level only: estimate word timings, mark low confidence.
        if not segments:
            raise ProviderError(
                "Google returned no word timestamps. Try Chirp 3 with word "
                "timestamps enabled or use ElevenLabs."
            )
        est_words: list = []
        prev_end = 0.0
        for seg in segments:
            seg_words = estimate_words_from_text(
                seg["text"], prev_end, seg["end"] or prev_end + 1.0, confidence=0.3
            )
            for w in seg_words:
                w.id = len(est_words)
                est_words.append(w)
            prev_end = seg["end"] or prev_end
        return ProviderResult(
            raw=raw, words=est_words, timing_quality="segment-estimated",
            warnings=["Google returned segment timings only; word timings are "
                      "estimated (low confidence)."],
        )
