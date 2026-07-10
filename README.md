# Kartuli Caption Forge

**Word-timed animated captions for After Effects — built for Georgian (ქართული), works for English too.**

Select a video in AE → transcribe with the AI provider of your choice → get animated
word-by-word caption layers (TikTok/CapCut style) at exact timestamps. What took hours
of manual keyframing takes minutes.

<!-- DEMO GIF: record ~20s of panel → Transcribe → Generate → playback, save as docs/demo.gif -->
<!-- ![demo](docs/demo.gif) -->

- 🎙️ **9 swappable ASR providers** — **ElevenLabs Scribe is the only one that handles
  Georgian well** (tested on real conversational audio). The others (Gladia, Azure,
  AssemblyAI, OpenAI, Google Chirp, local whisper variants) are wired in but poor or
  untested for Georgian — treat them as experimental / English-only
- ⏱️ **True word-level timestamps** — each word animates when it's spoken
- 🎨 **11 animation presets** — Highlight Word, Active Word Box (CapCut style), Bounce In,
  Pop Karaoke, Typewriter, Brutalist Georgian, and more
- 📐 Full typography control: any installed font, colors, multi-line wrapping, rounded
  background boxes, safe-area anchors for 9:16 / 1:1 / 16:9
- 🛡️ **Non-destructive** — everything generates into a fresh precomp; your work is never touched
- 🔍 Every intermediate JSON saved to `exports/` for debugging and hand-editing

Works on **macOS, Windows, Linux** (backend). After Effects panel: macOS + Windows
(Adobe doesn't ship AE for Linux — run the backend on Linux and AE elsewhere if needed).

License: MIT. Contributions welcome — especially new animation presets
(`ae/lib/presets.jsx`, ~10 lines each) and ASR adapters (`backend/providers/`, one file each).

---

## 1. What to download

### Required (all platforms)

| Thing | macOS | Windows | Linux |
|---|---|---|---|
| **Python 3.10+** | preinstalled / `brew install python` | [python.org](https://www.python.org/downloads/) — check "Add to PATH" | `sudo apt install python3 python3-venv` |
| **ffmpeg** | `brew install ffmpeg` | `winget install ffmpeg` or [ffmpeg.org](https://ffmpeg.org/download.html) → add to PATH | `sudo apt install ffmpeg` |
| **After Effects** | CC 2019+ | CC 2019+ | — |

### Optional — free local transcription (no API key, offline)

Pick ONE if you don't want to pay for cloud APIs:

**A. whisper.cpp** (fastest to set up on Mac)
```bash
# macOS
brew install whisper-cpp
# Windows: download release from github.com/ggml-org/whisper.cpp/releases
# Linux: build from source (cmake)
```
Then download a model into `~/models/whisper/` (create the folder):
- Best Georgian quality: [ggml-large-v3.bin](https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin) (~3 GB)
- Faster: [ggml-large-v3-turbo.bin](https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin) (~1.6 GB)
- If slow: [ggml-medium.bin](https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin) (~1.5 GB)
- **Never** `.en` models for Georgian.
- Note: whisper.cpp word timings are marked *experimental*.

**B. faster-whisper** (real word timestamps, Python, all platforms)
```bash
./.venv/bin/pip install faster-whisper        # mac/linux
.venv\Scripts\pip install faster-whisper      # windows
```
Model (`large-v3`) downloads automatically on first run (~3 GB).

**C. mlx-whisper** (Apple Silicon Macs only, fast)
```bash
./.venv/bin/pip install mlx-whisper
```
Model downloads automatically on first run.

### Cloud providers (best Georgian quality — recommended: ElevenLabs)

Nothing to download — just API keys (next section).

---

## 2. Where to put your API keys

1. Copy `backend/config.example.env` → rename the copy to `backend/.env`
2. Paste keys after the `=` signs. **In `backend/.env` the lines are:**

| Line | Key | Where to get it |
|---|---|---|
| **8** | `ELEVENLABS_API_KEY=` | elevenlabs.io → Profile → API Keys ← **START HERE, best for Georgian** |
| **12** | `OPENAI_API_KEY=` | platform.openai.com/api-keys |
| **16** | `GOOGLE_APPLICATION_CREDENTIALS=` | path to Google service-account .json file |
| **17** | `GOOGLE_CLOUD_PROJECT=` | your GCP project id |
| **22** | `AZURE_SPEECH_KEY=` | portal.azure.com → Speech resource → Keys |
| **23** | `AZURE_SPEECH_REGION=` | e.g. `westeurope` |
| **27** | `GLADIA_API_KEY=` | app.gladia.io |
| **31** | `ASSEMBLYAI_API_KEY=` | assemblyai.com/app |

You only need ONE provider to work. Fill only what you have.

### Georgian support per provider (real-world tested)

**Short version: use ElevenLabs for Georgian. Everything else disappointed or is untested.**

| Provider | Georgian (tested on conversational audio) | Word timestamps | Cost |
|---|---|---|---|
| **ElevenLabs Scribe v2** | ✅ **excellent — the only recommended option** | ✅ real | paid API (free tier to test, ~$0.22/audio-hour after) |
| faster-whisper (local) | ❌ bad (~20-30% right, skips words) | ✅ real | free |
| mlx-whisper (local) | ❌ bad (same whisper model) | ✅ real | free |
| whisper.cpp (local) | ❌ bad + experimental timings | ⚠️ experimental | free |
| Gladia (Whisper cloud) | ⚠️ untested, whisper-based so expect similar | ✅ real | free tier |
| Azure AI Speech | ⚠️ untested for Georgian | ✅ real | free tier 5h/month |
| AssemblyAI (nano) | ⚠️ untested for Georgian | ✅ real | paid, cheap |
| OpenAI whisper-1 | ⚠️ untested, whisper-based | ✅ real | paid, cheap |
| Google Chirp 2/3 | ⚠️ untested for Georgian | ✅ (Chirp 2/3) | paid |

For **English**, the local whisper providers work fine and cost nothing.

---

## 3. Start the backend

```bash
# macOS / Linux — first run creates venv + installs deps automatically
./run_backend.sh

# Windows
run_backend.bat
```
Backend runs at `http://127.0.0.1:8765`. Leave the terminal open.

Manual alternative:
```bash
python3 -m venv .venv
./.venv/bin/pip install -r backend/requirements.txt
./.venv/bin/python backend/app.py
```
For Google Chirp also: `pip install google-cloud-speech`

---

## 4. Install the AE panel

Copy **both** `ae/KartuliCaptionForge.jsx` **and** the `ae/lib/` folder into:

- **macOS:** `/Applications/Adobe After Effects <version>/Scripts/ScriptUI Panels/`
- **Windows:** `C:\Program Files\Adobe\Adobe After Effects <version>\Scripts\ScriptUI Panels\`

Then in AE:
1. `Preferences → Scripting & Expressions → Allow Scripts to Write Files and Access Network` ✅ (required!)
2. Restart AE → `Window → KartuliCaptionForge.jsx`

---

## 5. Usage

1. Open your comp with the Georgian video.
2. Panel → **Source**: Browse media file, Language = Georgian, Provider = ElevenLabs (press **Scan** to see which providers are ready).
3. **Transcribe** — captions preview appears.
4. **Type/Position/Animate** tabs: pick font (Georgian-supporting, e.g. `NotoSansGeorgian-Bold`), colors, anchor = Bottom center, preset = Highlight Word.
5. **Generate Captions** — a new `KCF_Captions_…` precomp lands in your comp. Your existing layers are never touched.
6. Bad timestamps? Inspect `exports/normalized.json` first, edit it, then **Load JSON** → **Generate Captions**.

Georgian fonts: **Noto Sans Georgian** (free, fonts.google.com/noto), Helvetica Neue LT GEO, BPG fonts.

## Troubleshooting

- *"Backend not running"* → start `./run_backend.sh`; check port matches panel (8765).
- *"Provider unavailable: missing …"* → key missing in `backend/.env`; restart backend after editing.
- Georgian shows as boxes → font doesn't include Georgian glyphs; use Noto Sans Georgian.
- Words mistimed → check `exports/raw_<provider>.json` vs `exports/normalized.json`; try another provider.

## Tests

```bash
cd backend && python3 -m unittest discover -s tests
```
