import json

import httpx


class LLMError(Exception):
    pass


class LLM:
    """Structured-output chat against a local Ollama server."""

    def __init__(self, model: str, host: str = "http://127.0.0.1:11434", timeout: float = 900):
        self.model, self.host, self.timeout = model, host.rstrip("/"), timeout

    def json(self, system: str, user: str, schema: dict) -> dict:
        try:
            resp = httpx.post(
                f"{self.host}/api/chat",
                json={
                    "model": self.model,
                    "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
                    "format": schema,
                    "stream": False,
                    "options": {"temperature": 0.2, "num_ctx": 16384},
                },
                timeout=self.timeout,
            )
            resp.raise_for_status()
            return json.loads(resp.json()["message"]["content"])
        except (httpx.HTTPError, KeyError, json.JSONDecodeError) as exc:
            raise LLMError(str(exc)) from exc
