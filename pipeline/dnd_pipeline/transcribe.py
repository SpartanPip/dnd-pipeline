from pathlib import Path


class Transcriber:
    def __init__(self, model: str, language: str | None = "en"):
        self.model, self.language = model, language

    def transcribe_chunk(self, path: Path, names: list[str]) -> list[dict]:
        import mlx_whisper

        prompt = ("D&D session. Character names: " + ", ".join(names) + ".") if names else "D&D session."
        result = mlx_whisper.transcribe(
            str(path),
            path_or_hf_repo=self.model,
            initial_prompt=prompt,
            condition_on_previous_text=False,
            language=self.language,
        )
        return [{"start": s["start"], "end": s["end"], "text": s["text"]} for s in result.get("segments", [])]
