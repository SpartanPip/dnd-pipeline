import json
import logging
import time

import httpx

log = logging.getLogger(__name__)


class LLMError(Exception):
    """The model answered, but not with usable output."""


class LLMUnavailable(Exception):
    """Ollama couldn't be reached or timed out; the job should fail and be resumed later."""


class LLM:
    """Structured-output chat against a local Ollama server."""

    def __init__(self, model: str, host: str = "http://127.0.0.1:11434", timeout: float = 900):
        self.model, self.host, self.timeout = model, host.rstrip("/"), timeout

    def json(self, system: str, user: str, schema: dict) -> dict:
        start = time.monotonic()
        try:
            resp = httpx.post(
                f"{self.host}/api/chat",
                json={
                    "model": self.model,
                    "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
                    "format": schema,
                    # Thinking models otherwise reason until the context fills and never emit the JSON.
                    "think": False,
                    "stream": False,
                    "options": {"temperature": 0.2, "num_ctx": 16384},
                },
                timeout=self.timeout,
            )
        except httpx.TransportError as exc:
            raise LLMUnavailable(f"Ollama at {self.host} isn't reachable ({exc}). Is ./start.sh running?") from exc
        if resp.status_code in (404, 501):
            # 501 is Ollama refusing `format` (MLX builds); 404 is a model that isn't pulled. Retrying can't help.
            raise LLMUnavailable(f"Ollama can't run {self.model} with structured output "
                                 f"({resp.status_code}: {resp.text[:200]}). Pull a GGUF build and re-run ./setup.sh.")
        try:
            resp.raise_for_status()
            data = resp.json()
            log.info("%s %s: %s tokens in %.1fs (%s)", self.model, schema.get("title", "?"), data.get("eval_count"),
                     time.monotonic() - start, data.get("done_reason"))
            if data.get("done_reason") == "length":
                raise LLMError(f"output hit the {data.get('eval_count')}-token limit before finishing")
            return json.loads(data["message"]["content"])
        except (httpx.HTTPError, KeyError, json.JSONDecodeError) as exc:
            raise LLMError(f"{exc}; response: {resp.text[:500]}") from exc
