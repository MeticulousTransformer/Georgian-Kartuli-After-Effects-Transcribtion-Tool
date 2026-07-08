# AGENT.md — Georgian/English Word-Timed Caption Animator for After Effects

## Mission

Build a macOS-friendly After Effects caption tool that transcribes Georgian and English speech, produces word-level timestamps, groups words into short sentence chunks, and generates animated word-by-word text layers in After Effects.

Primary language: Georgian (`ka`, `ka-GE`, `kat` depending on provider).
Secondary language: English.

The tool must be modular, testable, and provider-swappable. Do not hard-code one ASR provider. The core artifact is a normalized word-timeline JSON that all animation presets consume.

---

## Product Name

Working name: **Kartuli Caption Forge**

---

## Core User Story

As a video editor using After Effects on Mac, I want to select an audio/video file, choose Georgian or English, choose an AI transcription provider, get word-level timestamps, review/edit the transcript, and generate animated captions where each sentence has max 3–4 words and each word can animate/highlight according to a chosen design preset.

---

## Non-Negotiable Requirements

1. Must support Georgian transcription as the main priority.
2. Must support English mode too.
3. Must support swappable ASR providers:

   * ElevenLabs Scribe v2
   * Google Cloud Speech-to-Text Chirp 3 / Chirp 2
   * OpenAI whisper-1 / gpt-4o-transcribe fallback
   * Local whisper.cpp
   * Local faster-whisper or mlx-whisper if available
4. Must normalize all provider outputs into one internal JSON schema.
5. Must create word-level caption timing, not just sentence-level timing.
6. Must group captions into short chunks:

   * default max words per caption: 4
   * user can set max words: 1–6
   * prefer 3–4 words for Georgian social-video style
7. Must generate After Effects text layers with:

   * editable font
   * font size
   * font weight / style where AE font supports it
   * fill color
   * active highlight color
   * tracking
   * line height
   * x/y pixel position
   * left / center / right alignment
   * vertical offset
   * safe-area guides or presets for 9:16, 1:1, 16:9
8. Must include multiple animation presets.
9. Must never destroy user work. Generate into a new precomp/folder/layer group.
10. Must save intermediate JSON files for debugging and iteration.

---

## Recommended Architecture

Build two parts:

### 1. Local Backend

Use Python with FastAPI.

Responsibilities:

* Receive file path from AE panel.
* Extract audio with ffmpeg.
* Convert audio to `16kHz mono wav`.
* Run selected ASR adapter.
* Normalize output to `TranscriptDocument`.
* Group words into caption chunks.
* Return JSON to AE panel.
* Save debug files into `/exports`.

Backend folder:

```txt
backend/
  app.py
  requirements.txt
  config.example.env
  services/
    audio_extract.py
    provider_registry.py
    grouping.py
    normalize.py
    local_scan.py
  providers/
    base.py
    elevenlabs_scribe.py
    google_chirp.py
    openai_asr.py
    whisper_cpp.py
    faster_whisper_local.py
    mlx_whisper_local.py
  tests/
    test_grouping.py
    test_normalize.py
    fixtures/
```

### 2. After Effects Panel

Use ExtendScript / ScriptUI first for a dockable AE panel.

AE panel responsibilities:

* Choose media file.
* Choose language.
* Choose provider.
* Choose preset.
* Choose typography/layout options.
* Call local backend.
* Preview parsed captions in a text area.
* Generate AE layers from normalized JSON.
* Save/load preset settings.

AE folder:

```txt
ae/
  KartuliCaptionForge.jsx
  lib/
    json2.js
    http_client.jsx
    layer_builder.jsx
    text_measure.jsx
    presets.jsx
```

---

## Why This Split Exists

After Effects should not do heavy AI work.
After Effects should create layers.
Python should do transcription, ffmpeg, cloud APIs, local Whisper, JSON normalization, and tests.

---

## Backend API

### `GET /health`

Returns:

```json
{
  "ok": true,
  "version": "0.1.0",
  "availableProviders": ["elevenlabs", "google_chirp", "openai", "whisper_cpp"]
}
```

### `GET /providers`

Scans environment and local machine.

Return example:

```json
{
  "providers": [
    {
      "id": "elevenlabs",
      "label": "ElevenLabs Scribe v2",
      "type": "cloud",
      "available": true,
      "needsApiKey": true,
      "supportsWordTimestamps": true,
      "supportsGeorgian": true,
      "supportsEnglish": true
    },
    {
      "id": "whisper_cpp",
      "label": "Local whisper.cpp",
      "type": "local",
      "available": true,
      "path": "/opt/homebrew/bin/whisper-cli",
      "supportsWordTimestamps": "experimental"
    }
  ]
}
```

### `POST /transcribe`

Request:

```json
{
  "mediaPath": "/Users/me/Desktop/input.mp4",
  "language": "ka-GE",
  "provider": "elevenlabs",
  "providerOptions": {
    "model": "scribe_v2",
    "diarize": false,
    "keyterms": ["კახეთი", "თბილისი", "SmartProduction"]
  },
  "grouping": {
    "maxWords": 4,
    "maxChars": 42,
    "pauseBreakSeconds": 0.55,
    "minCaptionDuration": 0.5,
    "maxCaptionDuration": 3.5
  }
}
```

Response:

```json
{
  "document": {
    "id": "uuid",
    "sourceMediaPath": "/Users/me/Desktop/input.mp4",
    "language": "ka-GE",
    "provider": "elevenlabs",
    "duration": 31.42,
    "words": [],
    "captions": []
  },
  "debugPaths": {
    "audio": "exports/input_16k.wav",
    "rawProviderJson": "exports/raw_elevenlabs.json",
    "normalizedJson": "exports/normalized.json"
  }
}
```

---

## Normalized JSON Schema

All providers must be converted into this exact structure:

```json
{
  "id": "string",
  "sourceMediaPath": "string",
  "language": "ka-GE",
  "provider": "elevenlabs",
  "duration": 0,
  "words": [
    {
      "id": 0,
      "text": "გამარჯობა",
      "start": 0.12,
      "end": 0.48,
      "confidence": 0.92,
      "speaker": null,
      "punctuationAfter": "",
      "isEdited": false
    }
  ],
  "captions": [
    {
      "id": 0,
      "text": "გამარჯობა როგორ ხარ",
      "start": 0.12,
      "end": 1.45,
      "wordIds": [0, 1, 2],
      "lineIndex": 0
    }
  ]
}
```

Rules:

* `start` and `end` are seconds.
* Never trust provider punctuation blindly.
* Keep Georgian Unicode intact.
* Do not transliterate Georgian.
* Keep edited text separate from raw provider output if possible.

---

## ASR Provider Strategy

### Provider 1 — ElevenLabs Scribe v2

Use as the first Georgian provider.

Expected strengths:

* Georgian support.
* Word-level timestamps.
* Diarization if needed.
* Keyterm prompting.

Environment variable:

```txt
ELEVENLABS_API_KEY=
```

Adapter output must map provider words into normalized `words`.

Important:

* Ignore spacing tokens when generating word IDs.
* Preserve punctuation if returned.
* If provider returns punctuation as separate tokens, merge punctuation into `punctuationAfter`.

---

### Provider 2 — Google Chirp

Use Google Cloud Speech-to-Text V2.

Environment variables:

```txt
GOOGLE_APPLICATION_CREDENTIALS=
GOOGLE_CLOUD_PROJECT=
GOOGLE_CLOUD_LOCATION=eu
```

Language codes:

* Georgian: `ka-GE`
* English: `en-US` or `en-GB`

Models:

* Prefer `chirp_3` when available.
* Fallback to `chirp_2`.
* Fallback to `chirp`.

Important:

* Enable word-level timestamps when supported.
* If the model returns segment-level only, estimate word timing only as a fallback and mark `confidence` low.
* Warn the user when true word timings are unavailable.

---

### Provider 3 — OpenAI

Environment variable:

```txt
OPENAI_API_KEY=
```

Models:

* For word timestamps: use `whisper-1` with `response_format=verbose_json` and `timestamp_granularities=["word"]`.
* For higher text accuracy without word timestamps: allow `gpt-4o-transcribe`, but then alignment must be done separately or marked as non-word-timed.

Important:

* Do not use `gpt-4o-transcribe` as the primary word-timestamp provider unless a second alignment step exists.
* OpenAI adapter must expose capability flags clearly.

---

### Provider 4 — Local whisper.cpp

Scan common binary paths:

```txt
/opt/homebrew/bin/whisper-cli
/usr/local/bin/whisper-cli
./vendor/whisper.cpp/build/bin/whisper-cli
```

Scan model paths:

```txt
~/models/whisper/
~/.cache/whisper/
./models/
```

Recommended model:

* `large-v3` or `large-v3-turbo` for Georgian if available.
* `medium` if performance is bad.
* Avoid `.en` models for Georgian.

Command concept:

```bash
whisper-cli \
  -m /path/to/ggml-large-v3.bin \
  -f /path/to/audio.wav \
  -l ka \
  -oj \
  -ml 1
```

Important:

* `-ml 1` / max length 1 can produce experimental word-level timestamp-like output.
* Validate output carefully.
* Mark provider timing quality as `experimental`.

---

### Provider 5 — faster-whisper Local

Use Python package `faster-whisper`.

Recommended:

* model: `large-v3`
* compute type on Mac CPU may be slow; allow user to choose `int8`.
* Better on NVIDIA GPU than Mac, but useful as a Python fallback.

Important:

* If word timestamps are available, map them directly.
* If only segment timestamps are available, use local alignment fallback or mark low confidence.

---

### Provider 6 — mlx-whisper Local

Use only on Apple Silicon if installed.

Scan:

```bash
python -c "import mlx_whisper"
```

Important:

* Fast on Mac.
* If output lacks word-level timestamps, use it only for draft transcript or combine with alignment.

---

## Transcript Grouping Algorithm

Input: normalized words.
Output: caption chunks.

Rules:

1. Start a new caption when:

   * current caption has `maxWords`
   * pause between words exceeds `pauseBreakSeconds`
   * punctuation ends sentence: `.`, `?`, `!`, `…`
   * caption duration would exceed `maxCaptionDuration`
   * line would exceed `maxChars`
2. Keep Georgian words intact.
3. Do not split punctuation into separate captions.
4. If a caption is shorter than `minCaptionDuration`, extend its end time slightly unless it collides with the next caption.
5. Default grouping:

   * `maxWords = 4`
   * `maxChars = 42`
   * `pauseBreakSeconds = 0.55`
   * `minCaptionDuration = 0.5`
   * `maxCaptionDuration = 3.5`

---

## AE Layer Generation Strategy

Use one generated precomp per run.

Naming:

```txt
KCF_Captions_YYYYMMDD_HHMMSS
```

Create a folder in AE project:

```txt
Kartuli Caption Forge
```

For each caption chunk, generate one caption group.

Two rendering modes:

### Mode A — Separate Word Layers

Best for exact positioning and per-word animation.

For each caption:

* Create one text layer per word.
* Compute x positions from measured word widths.
* Keep all word layers inside one time span.
* Set each word layer in/out points based on preset behavior.

Pros:

* Best control.
* Each word can scale/color/move independently.
* Easier animation.

Cons:

* More layers.

Use this as default.

### Mode B — Single Sentence Layer + Text Animators

Use for simple karaoke/highlight presets.

Pros:

* Cleaner timeline.
* Better for full sentence display.

Cons:

* Per-word color logic is harder and less flexible.

Use only for simple presets.

---

## Text Measurement

After Effects text measurement is annoying. Use this strategy:

1. Create temporary hidden text layers for each word with selected font settings.
2. Use `sourceRectAtTime()` to read width/height.
3. Sum widths + user-defined spacing.
4. Compute group start x based on alignment:

   * center: `x - totalWidth / 2`
   * left: `x`
   * right: `x - totalWidth`
5. Place each word layer at exact pixel x/y.
6. Delete or hide measurement layers.

Must support:

* Georgian Unicode text.
* font size
* tracking
* faux bold where necessary
* line height

---

## UI Controls

Panel sections:

### Source

* Select media file
* Extract audio button
* Language:

  * Georgian
  * English
  * Auto-detect
* Provider dropdown
* Scan local providers button

### ASR Options

* API key status indicators
* Model dropdown
* Keyterms field
* Diarization checkbox
* Force language checkbox

### Grouping

* Max words per caption
* Max characters per caption
* Pause break threshold
* Min caption duration
* Max caption duration

### Typography

* Font family input/dropdown
* Font style/weight input
* Font size
* Tracking
* Line height
* Text color
* Highlight color
* Shadow on/off
* Stroke on/off
* Stroke width
* Background box on/off

### Position

* X pixel
* Y pixel
* Alignment: left / center / right
* Anchor preset:

  * bottom center
  * center
  * top center
  * custom
* Safe margin

### Animation Preset

* Highlight Word
* Spawn Word-by-Word
* Word-by-Word Disappear
* Pop Karaoke
* Typewriter
* Minimal Subtitle
* Brutalist Georgian
* Neon Pulse
* Documentary Clean

### Actions

* Transcribe
* Preview JSON
* Generate Captions
* Regenerate Selected Preset
* Clear Generated Captions

---

## Animation Presets

### 1. Highlight Word

All words in the caption appear at caption start.
Current spoken word changes color and optionally scales up.

Layer behavior:

* All word layers visible from caption start to caption end.
* Active word:

  * fill color changes to highlight color during word start/end.
  * scale 100% → 112% → 100%.
  * optional weight simulation via duplicate bold layer.

Use case:

* Clean educational / social media captions.

---

### 2. Spawn Word-by-Word

Each word appears exactly when spoken.
Words remain visible until the caption ends.

Behavior:

* word layer inPoint = word.start
* word layer outPoint = caption.end
* opacity keyframes:

  * `word.start - 0.05`: 0
  * `word.start`: 100
* scale:

  * 92% → 100%
* position:

  * y + 8 px → y

---

### 3. Word-by-Word Disappear

Words spawn when spoken and disappear individually when a new sentence begins or after their own end.

Behavior:

* word layer inPoint = word.start
* word layer outPoint = min(word.end + fadeOut, caption.end)
* opacity fades out after word end
* useful for fast reels where text should not stay too long.

---

### 4. Pop Karaoke

All words appear, but active word pops with color and tiny bounce.

Behavior:

* All words visible.
* Active word:

  * highlight color
  * scale peak 118%
  * optional rotation wiggle 1–2 degrees
* Non-active words dim to 60–75% opacity.

---

### 5. Typewriter Sentence

Caption appears as a growing sentence.

Behavior:

* Either single sentence layer with text animator, or word layers appearing sequentially.
* Less precise than separate word layers but visually clean.

---

### 6. Minimal Subtitle

No fancy motion.
Only short caption chunks, clean typography, optional active word underline.

Use case:

* Documentary / serious content.

---

### 7. Brutalist Georgian

Style:

* heavy font
* tight tracking
* sharp opacity cuts
* optional rectangular background
* active word in red/yellow/white depending user palette
* no soft bounce

Use case:

* Georgian techno-industrial mythpunk vibe.

---

### 8. Neon Pulse

Style:

* glow effect
* active word pulse
* optional blur-in

Keep glow optional because AE performance can suffer.

---

## Generated Layer Naming

Each generated layer should be named predictably:

```txt
KCF_C000_W000_გამარჯობა
KCF_C000_W001_როგორ
KCF_C000_W002_ხარ
```

Where:

* `C000` = caption index
* `W000` = word index inside caption

---

## Generated Comments / Metadata

Each generated layer should store metadata in comment if possible:

```json
{
  "tool": "Kartuli Caption Forge",
  "captionId": 0,
  "wordId": 12,
  "start": 1.24,
  "end": 1.58,
  "preset": "highlight_word"
}
```

---

## Error Handling

Show useful errors. Do not crash silently.

Examples:

* “No active composition selected.”
* “Backend not running. Start backend with `python backend/app.py`.”
* “Provider unavailable: missing ELEVENLABS_API_KEY.”
* “Google returned no word timestamps. Try Chirp 3 with word timestamps enabled or use ElevenLabs.”
* “Local whisper.cpp found, but no model found.”
* “Transcript has text but no word timings. Animation requires word timings.”

---

## Testing Requirements

Create sample fixture JSON files:

```txt
tests/fixtures/georgian_short.json
tests/fixtures/english_short.json
tests/fixtures/provider_elevenlabs_raw.json
tests/fixtures/provider_openai_whisper_raw.json
```

Test:

1. Georgian Unicode preservation.
2. Word grouping max 4 words.
3. Pause-based splitting.
4. Punctuation-based splitting.
5. Provider output normalization.
6. AE payload generation.
7. Missing timestamp handling.
8. Long caption rejection.
9. No destructive AE behavior.

---

## Minimal MVP Scope

Do this first. Do not overbuild.

### MVP v0.1

Backend:

* FastAPI server
* ffmpeg extraction
* ElevenLabs Scribe adapter
* OpenAI whisper-1 adapter
* Normalized JSON
* Grouping into max 4 words

AE:

* ScriptUI panel
* file picker
* provider dropdown
* font/size/color/x/y controls
* generate separate word layers
* two presets:

  * Highlight Word
  * Spawn Word-by-Word

After MVP works, add:

* Google Chirp
* whisper.cpp scan
* more presets
* transcript editor
* MOGRT export

---

## Implementation Order

1. Create backend skeleton.
2. Create normalized schema types.
3. Implement ffmpeg audio extraction.
4. Implement ElevenLabs provider.
5. Implement OpenAI whisper-1 provider.
6. Implement grouping.
7. Create test JSON output.
8. Create AE ScriptUI panel.
9. Create AE layer generator from saved JSON.
10. Implement Highlight Word preset.
11. Implement Spawn Word-by-Word preset.
12. Test on one Georgian clip.
13. Add local provider scanning.
14. Add Google provider.
15. Add transcript edit/retry loop.

---

## Quality Bar

The app is successful only if:

1. A Georgian MP4 can be selected.
2. The backend transcribes it into word-level JSON.
3. Captions are grouped into 3–4 word chunks.
4. AE generates text layers at exact x/y pixel positions.
5. Active word highlighting follows real word timestamps.
6. User can change font/weight/size/color/alignment without editing code.
7. Provider can be swapped without touching animation code.
8. Raw provider output and normalized output are saved for debugging.

---

## Design Principle

The ASR provider is replaceable.
The normalized word timeline is sacred.
The AE animation engine must never care whether text came from ElevenLabs, Google, OpenAI, Whisper, or a manually edited JSON file.

---

## First Demo Goal

Use a 10–20 second Georgian video.

Expected demo:

* Load MP4.
* Choose Georgian.
* Choose ElevenLabs.
* Max words: 4.
* Preset: Highlight Word.
* Font: user-selected Georgian-supporting font.
* Position: bottom center.
* Generate caption precomp.
* Play timeline.
* Each spoken word highlights at its timestamp.

If timestamps are bad, inspect `exports/normalized.json`, not AE layers first.

