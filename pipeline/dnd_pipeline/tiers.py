from dataclasses import dataclass

from .hardware import HardwareInfo

ROLES = ("transcription", "organizing", "images")
MIN_FREE_DISK_GB = 30

WHISPER_SMALL = "mlx-community/whisper-small-mlx"
WHISPER_TURBO = "mlx-community/whisper-large-v3-turbo"
IMAGE_MODEL = "z-image-turbo"


@dataclass(frozen=True)
class ModelChoice:
    role: str
    model: str | None
    note: str = ""
    quantize: int | None = None


def tier_for(hw: HardwareInfo) -> str:
    if not hw.apple_silicon or hw.memory_gb < 8:
        return "unsupported"
    if hw.memory_gb < 16:
        return "basic"
    if hw.memory_gb < 24:
        return "standard"
    if hw.memory_gb < 48:
        return "plus"
    return "max"


# Pinned GGUF builds: bare gemma4 tags pull MLX builds on Apple Silicon, which reject Ollama's `format`.
_TABLE = {
    "basic": (
        ModelChoice("transcription", WHISPER_SMALL),
        ModelChoice("organizing", "gemma4:e2b-it-q4_K_M", "small model: expect rougher notes"),
        ModelChoice("images", None, "not enough memory to generate images locally"),
    ),
    "standard": (
        ModelChoice("transcription", WHISPER_TURBO),
        ModelChoice("organizing", "gemma4:e4b-it-q4_K_M"),
        ModelChoice("images", IMAGE_MODEL, quantize=4),
    ),
    "plus": (
        ModelChoice("transcription", WHISPER_TURBO),
        ModelChoice("organizing", "gemma4:12b-it-q4_K_M"),
        ModelChoice("images", IMAGE_MODEL, quantize=8),
    ),
    "max": (
        ModelChoice("transcription", WHISPER_TURBO),
        ModelChoice("organizing", "gemma4:26b-a4b-it-q4_K_M"),
        ModelChoice("images", IMAGE_MODEL, quantize=8),
    ),
}


def recommend(hw: HardwareInfo) -> dict[str, ModelChoice]:
    tier = tier_for(hw)
    if tier == "unsupported":
        reason = "Intel Mac" if not hw.apple_silicon else f"only {hw.memory_gb} GB memory"
        choices = [ModelChoice(r, None, f"this Mac can't run local models ({reason})") for r in ROLES]
    else:
        choices = list(_TABLE[tier])
    if hw.free_disk_gb < MIN_FREE_DISK_GB:
        warn = f"low disk space ({hw.free_disk_gb} GB free; models need ~{MIN_FREE_DISK_GB} GB)"
        choices = [ModelChoice(c.role, c.model, "; ".join(filter(None, [c.note, warn])), c.quantize)
                   for c in choices]
    return {c.role: c for c in choices}
