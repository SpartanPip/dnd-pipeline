"""Local worker: records sessions and runs processing jobs one at a time. Listens on 127.0.0.1:8765."""

import logging
import re
import queue
import threading
from collections.abc import Callable
from dataclasses import dataclass

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from . import content, images, organize, sessions
from .config import load_config
from .paths import campaign_dir, content_root
from .pipeline import CHUNK_SECONDS, Deps, build_deps, listening_names, run_post_session

log = logging.getLogger(__name__)

HOST, PORT = "127.0.0.1", 8765
SLUG = re.compile(r"[a-z0-9]+(-[a-z0-9]+)*")


@dataclass
class Job:
    kind: str
    campaign: str
    session: int | None = None
    card: str | None = None
    change: str | None = None


class Worker:
    def __init__(self, recorder_factory: Callable, deps_factory: Callable[[], Deps],
                 post_session: Callable[[str, int, Deps], None] = run_post_session):
        self.recorder_factory, self.deps_factory, self.post_session = recorder_factory, deps_factory, post_session
        self.recording: tuple[str, int] | None = None
        self.recorder = None
        self.current: Job | None = None
        self.last_error: str | None = None
        self.jobs: queue.Queue[Job] = queue.Queue()
        self._live = queue.Queue()
        self._lock = threading.Lock()
        threading.Thread(target=self._run_jobs, daemon=True).start()
        threading.Thread(target=self._run_live, daemon=True).start()

    def start(self, campaign: str) -> sessions.SessionMeta:
        with self._lock:
            if self.recording:
                raise HTTPException(409, "Already recording")
            if not SLUG.fullmatch(campaign) or not campaign_dir(campaign).is_dir():
                raise HTTPException(404, "Unknown campaign")
            meta = sessions.new_session(campaign)
            n = meta.number
            self.recorder = self.recorder_factory(sessions.audio_dir(campaign, n),
                                                  lambda path: self._live.put((campaign, n)))
            self.recorder.start()
            self.recording = (campaign, n)
            return meta

    def stop(self) -> sessions.SessionMeta:
        with self._lock:
            if not self.recording:
                raise HTTPException(409, "Not recording")
            campaign, n = self.recording
            self.recorder.stop()
            self.recording, self.recorder = None, None
            meta = sessions.load_meta(campaign, n)
            meta.ended_at, meta.status, meta.message = content.now_iso(), "transcribing", "Queued for processing"
            sessions.save_meta(campaign, meta)
            self.jobs.put(Job("process", campaign, n))
            return meta

    def submit(self, job: Job) -> None:
        self.jobs.put(job)

    def recover(self) -> None:
        root = content_root()
        if not root.exists():
            return
        for d in sorted(root.iterdir()):
            for meta in sessions.list_sessions(d.name):
                if meta.status == "recording":
                    meta.ended_at, meta.status = meta.ended_at or content.now_iso(), "transcribing"
                    meta.message = "Recording was interrupted; processing what was captured"
                    sessions.save_meta(d.name, meta)
                if meta.status in ("transcribing", "organizing", "imaging"):
                    self.jobs.put(Job("process", d.name, meta.number))

    def wait_idle(self) -> None:
        self.jobs.join()

    def status(self) -> dict:
        rec = {"campaign": self.recording[0], "session": self.recording[1]} if self.recording else None
        job = None
        if self.current:
            job = {"kind": self.current.kind, "campaign": self.current.campaign, "session": self.current.session,
                   "card": self.current.card}
        return {"recording": rec, "job": job, "queued": self.jobs.qsize(), "last_error": self.last_error}

    def _run_live(self) -> None:
        while True:
            campaign, n = self._live.get()
            try:
                deps = self.deps_factory()
                if deps.transcriber:
                    sessions.transcribe_pending(campaign, n, deps.transcriber, listening_names(campaign), CHUNK_SECONDS)
            except Exception:
                log.exception("Live transcription failed; it will be retried after the session")

    def _run_jobs(self) -> None:
        while True:
            job = self.jobs.get()
            self.current = job
            try:
                deps = self.deps_factory()
                if job.kind == "process":
                    self.post_session(job.campaign, job.session, deps)
                elif job.kind == "apply-answers" and deps.llm:
                    organize.apply_answers(job.campaign, deps.llm)
                elif job.kind == "redraw":
                    if not (deps.images and deps.llm):
                        raise RuntimeError("No image model configured. Run ./setup.sh to pick one.")
                    images.redraw(job.campaign, job.card, job.change, deps.images, deps.llm)
                self.last_error = None
            except Exception as exc:
                log.exception("Job %s failed", job)
                self.last_error = f"{job.kind}: {exc}"
            finally:
                self.current = None
                self.jobs.task_done()


class StartBody(BaseModel):
    campaign: str


class RedrawBody(BaseModel):
    change: str


def _check(*slugs: str) -> None:
    if not all(SLUG.fullmatch(s) for s in slugs):
        raise HTTPException(404, "Not found")


def create_app(worker: Worker) -> FastAPI:
    app = FastAPI(title="dnd-pipeline worker")

    @app.get("/health")
    def health():
        return {"ok": True, "config": load_config().model_dump()}

    @app.get("/status")
    def status():
        return worker.status()

    @app.post("/sessions/start")
    def start(body: StartBody):
        return worker.start(body.campaign)

    @app.post("/sessions/stop")
    def stop():
        return worker.stop()

    @app.post("/campaigns/{campaign}/sessions/{n}/process", status_code=202)
    def process(campaign: str, n: int):
        _check(campaign)
        if not (sessions.session_dir(campaign, n) / "session.json").exists():
            raise HTTPException(404, "Unknown session")
        meta = sessions.load_meta(campaign, n)
        if meta.status == "done":
            state = sessions.load_state(campaign, n)
            sessions.save_state(campaign, n, sessions.SessionState(transcribed=state.transcribed))
        meta.status, meta.message, meta.error = "transcribing", "Queued for processing", None
        sessions.save_meta(campaign, meta)
        worker.submit(Job("process", campaign, n))
        return {"queued": True}

    @app.post("/campaigns/{campaign}/apply-answers", status_code=202)
    def apply_answers(campaign: str):
        _check(campaign)
        worker.submit(Job("apply-answers", campaign))
        return {"queued": True}

    @app.post("/campaigns/{campaign}/cards/{card}/redraw", status_code=202)
    def redraw(campaign: str, card: str, body: RedrawBody):
        _check(campaign, card)
        found = content.read_card(campaign, card)
        if found is None or found.origin != "pipeline":
            raise HTTPException(404, "Not a pipeline card")
        if not body.change.strip():
            raise HTTPException(400, "Describe what changed")
        worker.submit(Job("redraw", campaign, card=card, change=body.change))
        return {"queued": True}

    return app


def _cached_deps() -> Callable[[], Deps]:
    cache: dict[str, Deps] = {}

    def factory() -> Deps:
        cfg = load_config()
        key = cfg.model_dump_json()
        if key not in cache:
            cache.clear()
            cache[key] = build_deps(cfg)
        return cache[key]

    return factory


def main() -> None:
    import uvicorn

    from .recorder import Recorder

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    worker = Worker(recorder_factory=Recorder, deps_factory=_cached_deps())
    worker.recover()
    uvicorn.run(create_app(worker), host=HOST, port=PORT, log_level="warning")
