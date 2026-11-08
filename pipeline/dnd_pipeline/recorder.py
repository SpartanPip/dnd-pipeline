"""Mic recorder that writes 30-second WAV chunks and reports each finished chunk."""

import threading
import time
from collections.abc import Callable
from pathlib import Path

SAMPLE_RATE = 16000


class Recorder:
    def __init__(self, out_dir: Path, on_chunk: Callable[[Path], None], chunk_seconds: int = 30):
        self.out_dir, self.on_chunk, self.chunk_seconds = out_dir, on_chunk, chunk_seconds
        self._lock = threading.Lock()
        self._index = 0
        self._frames = 0
        self._file = None
        self._stream = None
        self._last_chunk_at = time.monotonic()
        self._error: str | None = None

    def _open_next(self) -> None:
        import soundfile as sf

        self._index += 1
        self._frames = 0
        self._file = sf.SoundFile(self._part_path(self._index), "w", samplerate=SAMPLE_RATE, channels=1,
                                  format="WAV", subtype="PCM_16")

    def _part_path(self, index: int) -> Path:
        return self.out_dir / f"chunk-{index:04d}.wav.part"

    def _finish_current(self) -> None:
        if self._file is None:
            return
        self._file.close()
        part = self._part_path(self._index)
        final = part.with_suffix("")
        part.rename(final)
        self._file = None
        self._last_chunk_at = time.monotonic()
        threading.Thread(target=self.on_chunk, args=(final,), daemon=True).start()

    def _callback(self, indata, frames, time_info, status) -> None:
        with self._lock:
            if self._file is None:
                return
            try:
                self._file.write(indata.copy())
                self._frames += frames
                if self._frames >= self.chunk_seconds * SAMPLE_RATE:
                    self._finish_current()
                    self._open_next()
            except Exception as exc:
                self._error = f"Recording stopped: {exc}"
                self._file = None

    def health(self) -> dict:
        """Seconds since the last finished chunk, and any error; the Session page warns when audio stalls."""
        error = self._error
        if error is None and self._stream is not None and not self._stream.active:
            error = "The microphone stream stopped"
        return {"last_chunk_age": round(time.monotonic() - self._last_chunk_at, 1), "error": error}

    def start(self) -> None:
        import sounddevice as sd

        self.out_dir.mkdir(parents=True, exist_ok=True)
        with self._lock:
            self._open_next()
        self._stream = sd.InputStream(samplerate=SAMPLE_RATE, channels=1, dtype="float32", callback=self._callback)
        self._stream.start()

    def stop(self) -> None:
        if self._stream is not None:
            self._stream.stop()
            self._stream.close()
        with self._lock:
            self._finish_current()
