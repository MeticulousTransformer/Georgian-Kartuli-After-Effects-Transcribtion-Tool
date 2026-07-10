---
type: "query"
date: "2026-07-10T11:14:49.195099+00:00"
question: "Why does Word connect Provider Interface to Cloud ASR Providers, Normalized Data Model, Caption Grouping, and Local Whisper Scanning?"
contributor: "graphify"
source_nodes: ["Word", "ProviderResult", "group_words", "words_from_simple", "words_from_tokens", "build_document"]
---

# Q: Why does Word connect Provider Interface to Cloud ASR Providers, Normalized Data Model, Caption Grouping, and Local Whisper Scanning?

## Answer

Word (backend/services/models.py) is the single currency of the whole system. Every ASR provider community touches it because every adapter's transcribe() must output List[Word] — via words_from_tokens (ElevenLabs), words_from_simple (OpenAI/Gladia/AssemblyAI/Azure/faster-whisper/mlx), direct construction (Google Chirp, whisper.cpp), or estimate_words_from_text fallback. ProviderResult carries List[Word] as the shared contract. Caption Grouping consumes Word: group_words() reads .start/.end/.punctuationAfter to chunk captions; tests build Words directly. Normalized Data Model contains Word (build_document serializes it). This is the deliberate hub-and-spoke: AGENTS.md's 'the normalized word timeline is sacred' — providers replaceable precisely because they all converge on Word.

## Source Nodes

- Word
- ProviderResult
- group_words
- words_from_simple
- words_from_tokens
- build_document