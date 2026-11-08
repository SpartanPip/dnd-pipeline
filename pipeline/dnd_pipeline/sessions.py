"""Per-session files: content/campaigns/<slug>/sessions/<n>/{session.json,state.json,audio/,transcript.jsonl}."""

import json
import threading
from pathlib import Path
from typing import Literal, Protocol

from pydantic import BaseModel

from .content import now_iso
from .paths import sessions_dir

Status = Literal["recording", "transcribing", "organizing", "imaging", "done", "error"]

_transcribe_lock = threading.Lock()


class SessionMeta(BaseModel):
    number: int
    started_at: str
    ended_at: str | None = None
    status: Status = "recording"
    step: str = ""
    progress: float = 0.0
    message: str = ""
    error: str | None = None
    has_audio: bool = True


class SessionState(BaseModel):
    transcribed: list[str] = []
    organized_windows: int = 0
    skipped_windows: list[int] = []
    pending_links: dict[str, list[str]] = {}
    answers_applied: bool = False
    images_done: bool = False


class Transcribes(Protocol):
    def transcribe_chunk(self, path: Path, names: list[str]) -> list[dict]: ...


def session_dir(slug: str, n: int) -> Path:
    return sessions_dir(slug) / str(n)


def audio_dir(slug: str, n: int) -> Path:
    return session_dir(slug, n) / "audio"


def list_sessions(slug: str) -> list[SessionMeta]:
    d = sessions_dir(slug)
    if not d.exists():
        return []
    metas = [load_meta(slug, int(p.name)) for p in d.iterdir() if p.name.isdigit() and (p / "session.json").exists()]
    return sorted(metas, key=lambda m: m.number)


def new_session(slug: str) -> SessionMeta:
    existing = [m.number for m in list_sessions(slug)]
    meta = SessionMeta(number=max(existing, default=0) + 1, started_at=now_iso())
    audio_dir(slug, meta.number).mkdir(parents=True)
    save_meta(slug, meta)
    return meta


def load_meta(slug: str, n: int) -> SessionMeta:
    return SessionMeta.model_validate_json((session_dir(slug, n) / "session.json").read_text())


def save_meta(slug: str, meta: SessionMeta) -> None:
    (session_dir(slug, meta.number) / "session.json").write_text(meta.model_dump_json(indent=2) + "\n")


def load_state(slug: str, n: int) -> SessionState:
    path = session_dir(slug, n) / "state.json"
    return SessionState.model_validate_json(path.read_text()) if path.exists() else SessionState()


def save_state(slug: str, n: int, state: SessionState) -> None:
    (session_dir(slug, n) / "state.json").write_text(state.model_dump_json(indent=2) + "\n")


def audio_chunks(slug: str, n: int) -> list[Path]:
    d = audio_dir(slug, n)
    return sorted(d.glob("chunk-*.wav")) if d.exists() else []


def chunk_index(path: Path | str) -> int:
    return int(Path(path).stem.split("-")[1])


def append_transcript(slug: str, n: int, chunk: str, segments: list[dict], offset: float) -> None:
    with (session_dir(slug, n) / "transcript.jsonl").open("a") as f:
        for seg in segments:
            text = seg["text"].strip()
            if text:
                f.write(json.dumps({"chunk": chunk, "start": seg["start"] + offset,
                                    "end": seg["end"] + offset, "text": text}) + "\n")


def read_transcript(slug: str, n: int) -> list[dict]:
    path = session_dir(slug, n) / "transcript.jsonl"
    if not path.exists():
        return []
    lines = [json.loads(line) for line in path.read_text().splitlines() if line.strip()]
    return sorted(lines, key=lambda l: l["start"])


def transcribe_pending(slug: str, n: int, transcriber: Transcribes, names: list[str], chunk_seconds: int = 30) -> int:
    """Transcribe chunks not yet in state.transcribed; safe to call from the live thread and post-session."""
    done = 0
    with _transcribe_lock:
        for path in audio_chunks(slug, n):
            state = load_state(slug, n)
            if path.name in state.transcribed:
                continue
            segments = transcriber.transcribe_chunk(path, names)
            offset = (chunk_index(path) - 1) * chunk_seconds
            append_transcript(slug, n, path.name, segments, offset)
            state.transcribed.append(path.name)
            save_state(slug, n, state)
            done += 1
    return done
