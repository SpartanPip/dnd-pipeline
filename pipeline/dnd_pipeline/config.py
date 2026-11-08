import json

from pydantic import BaseModel

from .paths import config_path


class Config(BaseModel):
    transcription: str | None = None
    organizing: str | None = None
    images: str | None = None
    image_quantize: int = 8
    tier: str = "unknown"
    ollama_host: str = "http://127.0.0.1:11434"


def load_config() -> Config:
    path = config_path()
    if not path.exists():
        return Config()
    return Config.model_validate(json.loads(path.read_text()))


def save_config(cfg: Config) -> None:
    config_path().write_text(cfg.model_dump_json(indent=2) + "\n")
