"""Mic recorder that writes 30-second WAV chunks and reports each finished chunk."""

import threading
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
        threading.Thread(target=self.on_chunk, args=(final,), daemon=True).start()

    def _callback(self, indata, frames, time, status) -> None:
        with self._lock:
            if self._file is None:
                return
            self._file.write(indata.copy())
            self._frames += frames
            if self._frames >= self.chunk_seconds * SAMPLE_RATE:
                self._finish_current()
                self._open_next()

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
