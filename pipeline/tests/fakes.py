import json

from dnd_pipeline.llm import LLMError


class FakeLLM:
    """Returns queued responses per schema name; a string response simulates malformed output."""

    def __init__(self, responses: dict[str, list]):
        self.responses = {k: list(v) for k, v in responses.items()}
        self.calls: list[tuple[str, str]] = []

    def json(self, system: str, user: str, schema: dict) -> dict:
        name = schema["title"]
        self.calls.append((name, user))
        queue = self.responses.get(name) or []
        if not queue:
            raise LLMError(f"no fake response for {name}")
        value = queue.pop(0)
        if isinstance(value, str):
            raise LLMError(f"bad json: {value}")
        return json.loads(json.dumps(value))


class FakeImages:
    def __init__(self):
        self.prompts: list[str] = []

    def generate(self, prompt: str, out_path, seed: int = 0) -> None:
        self.prompts.append(prompt)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_bytes(b"png")
