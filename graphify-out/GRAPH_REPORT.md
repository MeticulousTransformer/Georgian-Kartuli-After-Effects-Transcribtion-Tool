# Graph Report - /Users/hanzopanzo/Desktop/Captions  (2026-07-10)

## Corpus Check
- Corpus is ~14,710 words - fits in a single context window. You may not need a graph.

## Summary
- 222 nodes · 545 edges · 8 communities detected
- Extraction: 64% EXTRACTED · 36% INFERRED · 0% AMBIGUOUS · INFERRED: 195 edges (avg confidence: 0.67)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Cloud ASR Providers|Cloud ASR Providers]]
- [[_COMMUNITY_AE Panel & Animation Presets|AE Panel & Animation Presets]]
- [[_COMMUNITY_FastAPI Backend App|FastAPI Backend App]]
- [[_COMMUNITY_Provider Interface & Google Chirp|Provider Interface & Google Chirp]]
- [[_COMMUNITY_Normalized Data Model|Normalized Data Model]]
- [[_COMMUNITY_Caption Grouping|Caption Grouping]]
- [[_COMMUNITY_Local Whisper Scanning|Local Whisper Scanning]]
- [[_COMMUNITY_HTTP Bridge (AE-Backend)|HTTP Bridge (AE-Backend)]]

## God Nodes (most connected - your core abstractions)
1. `ProviderError` - 38 edges
2. `Word` - 31 edges
3. `ProviderResult` - 30 edges
4. `ASRProvider` - 27 edges
5. `group_words()` - 22 edges
6. `words_from_simple()` - 18 edges
7. `lang_short()` - 16 edges
8. `transcribe()` - 15 edges
9. `WhisperCppProvider` - 15 edges
10. `TestGrouping` - 15 edges

## Surprising Connections (you probably didn't know these)
- `KCF_breakLines()` --semantically_similar_to--> `Transcript Grouping Algorithm (maxWords/maxChars/pause rules)`  [INFERRED] [semantically similar]
  /Users/hanzopanzo/Desktop/Captions/ae/lib/layer_builder.jsx → AGENTS.md
- `buildUI()` --references--> `Transcript Grouping Algorithm (maxWords/maxChars/pause rules)`  [INFERRED]
  /Users/hanzopanzo/Desktop/Captions/ae/KartuliCaptionForge.jsx → AGENTS.md
- `KCF_buildCaption()` --implements--> `Mode A: Separate Word Layers (default rendering mode)`  [INFERRED]
  /Users/hanzopanzo/Desktop/Captions/ae/lib/layer_builder.jsx → AGENTS.md
- `KCF_buildCaption()` --implements--> `Text Measurement Strategy (sourceRectAtTime width summing)`  [INFERRED]
  /Users/hanzopanzo/Desktop/Captions/ae/lib/layer_builder.jsx → AGENTS.md
- `buildUI()` --references--> `Backend HTTP API contract (/health, /providers, /transcribe)`  [EXTRACTED]
  /Users/hanzopanzo/Desktop/Captions/ae/KartuliCaptionForge.jsx → AGENTS.md

## Hyperedges (group relationships)
- **Pluggable ASR provider adapter pattern (registry + interface + 9 adapters)** — base_asrprovider, provider_registry_providers, elevenlabs_scribe_elevenlabsscribeprovider, google_chirp_googlechirpprovider, openai_asr_openaiasrprovider, azure_speech_azurespeechprovider, gladia_gladiaprovider, assemblyai_assemblyaiprovider, whisper_cpp_whispercppprovider, faster_whisper_local_fasterwhisperprovider, mlx_whisper_local_mlxwhisperprovider [EXTRACTED 1.00]
- **Media -> audio -> ASR -> normalized words -> captions -> document pipeline** — app_transcribe, audio_extract_extract_audio, provider_registry_get_provider, base_asrprovider, grouping_group_words, models_build_document [EXTRACTED 1.00]
- **Graceful degradation to estimated word timings when provider lacks word timestamps** — normalize_estimate_words_from_text, google_chirp_googlechirpprovider, openai_asr_openaiasrprovider, base_providerresult [INFERRED 0.85]
- **Transcribe-to-Captions Pipeline (panel -> HTTP -> backend API -> TranscriptDocument -> AE layers)** — kartulicaptionforge_buildui, http_client_kcf_httpjson, agents_backend_api, agents_transcriptdocument, layer_builder_kcf_generate [INFERRED 0.90]
- **Per-Word Caption Rendering Engine (style, measure, position, animate, box)** — layer_builder_kcf_buildcaption, text_measure_kcf_styletextlayer, presets_kcf_presets, layer_builder_kcf_addroundrect [EXTRACTED 1.00]

## Communities

### Community 0 - "Cloud ASR Providers"
Cohesion: 0.15
Nodes (24): ASRProvider, AssemblyAIProvider, AssemblyAI. Georgian ('ka') supported via nano speech model.  Env: ASSEMBLYAI_AP, AzureSpeechProvider, Microsoft Azure AI Speech — fast transcription REST API.  Supports Georgian (ka-, ASRProvider, lang_bcp47(), lang_short() (+16 more)

### Community 1 - "AE Panel & Animation Presets"
Cohesion: 0.08
Nodes (36): Animation Presets specification (Highlight Word, Spawn, Karaoke, ...), Design Principle: provider replaceable, normalized word timeline is sacred, Transcript Grouping Algorithm (maxWords/maxChars/pause rules), Kartuli Caption Forge (product), Generated Layer Naming Convention (KCF_C000_W000_word), Mode A: Separate Word Layers (default rendering mode), Non-Destructive Generation (fresh precomp per run, never touch user work), Text Measurement Strategy (sourceRectAtTime width summing) (+28 more)

### Community 2 - "FastAPI Backend App"
Cohesion: 0.09
Nodes (26): _save_json helper, extract(), ExtractRequest, GroupingModel, health(), load_env(), providers(), Kartuli Caption Forge — local backend.  Run:  python backend/app.py   (or: cd ba (+18 more)

### Community 3 - "Provider Interface & Google Chirp"
Cohesion: 0.14
Nodes (16): Provider interface. Every ASR adapter implements ASRProvider., User-facing provider failure (missing key, API error...)., ka-GE' -> 'ka', 'en-US' -> 'en', auto -> ''., GoogleChirpProvider, Google Cloud Speech-to-Text V2 (Chirp 3 -> Chirp 2 -> Chirp fallback).  Requires, Word, estimate_words_from_text(), Provider output -> normalized Word list.  Rules (AGENTS.md): - Keep Georgian Uni (+8 more)

### Community 4 - "Normalized Data Model"
Cohesion: 0.12
Nodes (11): build_document(), Caption, Normalized transcript data model.  All ASR providers convert their raw output in, normalize_elevenlabs(), normalize_openai_verbose(), load_fixture(), Normalization tests (unittest + pytest compatible)., TestDocument (+3 more)

### Community 5 - "Caption Grouping"
Cohesion: 0.2
Nodes (9): caption_text(), ends_sentence(), from_dict(), group_words(), GroupingOptions, Word -> caption chunk grouping (AGENTS.md rules).  New caption starts when:   -, Grouping tests (unittest + pytest compatible)., TestGrouping (+1 more)

### Community 6 - "Local Whisper Scanning"
Cohesion: 0.3
Nodes (8): find_whisper_cpp_binary(), find_whisper_model(), is_apple_silicon(), list_whisper_models(), module_available(), Scan local machine for offline ASR tools and models. Cross-platform., scan_local(), WhisperCppProvider

### Community 7 - "HTTP Bridge (AE-Backend)"
Cohesion: 0.23
Nodes (12): Backend HTTP API contract (/health, /providers, /transcribe), KCF_hasCurl(), KCF_httpJSON(), KCF_httpViaCurl(), KCF_httpViaSocket(), KCF_readFileUTF8(), KCF_utf8Decode(), KCF_utf8Encode() (+4 more)

## Ambiguous Edges - Review These
- `Requests dependency` → `Backend HTTP API contract (/health, /providers, /transcribe)`  [AMBIGUOUS]
  backend/requirements.txt · relation: conceptually_related_to

## Knowledge Gaps
- **15 isolated node(s):** `-> (available: bool, detail: Optional[str])`, `Normalization tests (unittest + pytest compatible).`, `Normalized transcript data model.  All ASR providers convert their raw output in`, `ffmpeg audio extraction -> 16 kHz mono WAV. Cross-platform.`, `Extract audio track to <stem>_16k.wav (16 kHz mono PCM).` (+10 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Requests dependency` and `Backend HTTP API contract (/health, /providers, /transcribe)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `Word` connect `Provider Interface & Google Chirp` to `Cloud ASR Providers`, `Normalized Data Model`, `Caption Grouping`, `Local Whisper Scanning`?**
  _High betweenness centrality (0.155) - this node is a cross-community bridge._
- **Why does `ProviderError` connect `Cloud ASR Providers` to `FastAPI Backend App`, `Provider Interface & Google Chirp`, `Local Whisper Scanning`?**
  _High betweenness centrality (0.096) - this node is a cross-community bridge._
- **Why does `transcribe()` connect `FastAPI Backend App` to `Cloud ASR Providers`, `Normalized Data Model`, `Caption Grouping`?**
  _High betweenness centrality (0.089) - this node is a cross-community bridge._
- **Are the 33 inferred relationships involving `ProviderError` (e.g. with `GroupingModel` and `ExtractRequest`) actually correct?**
  _`ProviderError` has 33 INFERRED edges - model-reasoned connections that need verification._
- **Are the 19 inferred relationships involving `Word` (e.g. with `Local whisper.cpp. Free, offline, cross-platform.  Runs whisper-cli with -oj -ml` and `Google Cloud Speech-to-Text V2 (Chirp 3 -> Chirp 2 -> Chirp fallback).  Requires`) actually correct?**
  _`Word` has 19 INFERRED edges - model-reasoned connections that need verification._
- **Are the 27 inferred relationships involving `ProviderResult` (e.g. with `ElevenLabsScribeProvider` and `ElevenLabs Scribe — primary Georgian provider. Word-level timestamps.`) actually correct?**
  _`ProviderResult` has 27 INFERRED edges - model-reasoned connections that need verification._