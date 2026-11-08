"""Post-session processing: finish transcription, organize, apply answers, draw pending images."""

import logging
import traceback
from dataclasses import dataclass

from . import content, images, organize, sessions
from .config import Config
from .images import Generates

log = logging.getLogger(__name__)

CHUNK_SECONDS = 30


@dataclass
class Deps:
    transcriber: sessions.Transcribes | None = None
    llm: organize.StructuredLLM | None = None
    images: Generates | None = None


def build_deps(cfg: Config) -> Deps:
    from .llm import LLM
    from .transcribe import Transcriber

    return Deps(
        transcriber=Transcriber(cfg.transcription, cfg.language) if cfg.transcription else None,
        llm=LLM(cfg.organizing, cfg.ollama_host) if cfg.organizing else None,
        images=images.ImageGenerator(cfg.image_quantize) if cfg.images else None,
    )


def listening_names(slug: str) -> list[str]:
    names = content.read_names(slug)
    return names.listening or [k.name for k in names.known][:40]


def run_post_session(slug: str, n: int, deps: Deps) -> None:
    meta = sessions.load_meta(slug, n)
    skipped: list[str] = []

    def update(status: str, start: float, end: float):
        def cb(fraction: float, message: str) -> None:
            meta.status, meta.message = status, message
            meta.progress = round(start + (end - start) * fraction, 3)
            sessions.save_meta(slug, meta)
        return cb

    try:
        meta.error = None
        if deps.transcriber:
            update("transcribing", 0.0, 0.2)(0, "Finishing transcription")
            sessions.transcribe_pending(slug, n, deps.transcriber, listening_names(slug), CHUNK_SECONDS)
        else:
            skipped.append("transcription")

        state = sessions.load_state(slug, n)
        if deps.llm:
            organize.organize_session(slug, n, deps.llm, update("organizing", 0.2, 0.7))
            state = sessions.load_state(slug, n)
            if not state.answers_applied:
                update("organizing", 0.7, 0.75)(0, "Applying your answers")
                organize.apply_answers(slug, deps.llm)
                state.answers_applied = True
                sessions.save_state(slug, n, state)
        else:
            skipped.append("organizing")

        if deps.images and deps.llm:
            if not state.images_done:
                images.process_pending(slug, deps.images, deps.llm, update("imaging", 0.75, 1.0))
                state.images_done = True
                sessions.save_state(slug, n, state)
        else:
            skipped.append("images")

        meta.status, meta.progress = "done", 1.0
        notes = []
        if skipped:
            notes.append(f"skipped {', '.join(skipped)}: no model configured")
        if lost := len(sessions.load_state(slug, n).skipped_windows):
            notes.append(f"{lost} part{'s' if lost > 1 else ''} of the transcript couldn't be organized; try Re-process")
        meta.message = "Done" + (f" ({'; '.join(notes)})" if notes else "")
    except Exception as exc:
        log.error("Session %s/%d failed: %s", slug, n, traceback.format_exc())
        meta.status, meta.error = "error", str(exc)
    sessions.save_meta(slug, meta)
