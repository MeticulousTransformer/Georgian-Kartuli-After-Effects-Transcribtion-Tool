"""Local smoke check: installed dependencies and audio extraction, no AE or cloud calls."""
from pathlib import Path
import sys
import tempfile
import wave

runtime = Path(sys.argv[1]).resolve()
sys.path.insert(0, str(runtime / "backend"))
import fastapi, uvicorn, pydantic, requests, imageio_ffmpeg
from services.audio_extract import extract_audio, find_ffmpeg

binary = Path(find_ffmpeg()).resolve()
assert runtime in binary.parents, "Audio binary should come from the private installation."
with tempfile.TemporaryDirectory(prefix="audio-check-", dir=runtime) as folder:
    source = Path(folder) / "sample.wav"
    with wave.open(str(source), "wb") as audio:
        audio.setnchannels(2)
        audio.setsampwidth(2)
        audio.setframerate(44100)
        audio.writeframes(b"\0" * (11025 * 2 * 2))
    result = extract_audio(str(source), str(Path(folder) / "output"))
    with wave.open(result, "rb") as audio:
        assert audio.getnchannels() == 1
        assert audio.getframerate() == 16000
        assert audio.getnframes() > 0
print("Private service imports and bundled audio extraction passed (16 kHz mono WAV).")
