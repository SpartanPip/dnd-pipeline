"""Interactive model setup: optional hardware check, recommendations, overrides, downloads."""

import shutil
import subprocess
import sys

from .config import Config, load_config, save_config
from .hardware import detect_hardware
from .tiers import ROLES, ModelChoice, recommend, tier_for

ROLE_LABELS = {
    "transcription": "Transcription (speech to text)",
    "organizing": "Organizing (writes the cards)",
    "images": "Images (sticker art)",
}


def resolve_answer(answer: str, rec: ModelChoice) -> str | None:
    answer = answer.strip()
    if not answer:
        return rec.model
    if answer.lower() == "none":
        return None
    return answer


def config_from_choices(models: dict[str, str | None], recs: dict[str, ModelChoice], tier: str) -> Config:
    image_rec = recs.get("images")
    quantize = image_rec.quantize if image_rec and image_rec.quantize else 8
    return Config(tier=tier, image_quantize=quantize, **models)


def _ask(prompt: str, default_yes: bool = True) -> bool:
    suffix = " [Y/n] " if default_yes else " [y/N] "
    answer = input(prompt + suffix).strip().lower()
    return default_yes if not answer else answer.startswith("y")


def _run(cmd: list[str]) -> bool:
    print("  $ " + " ".join(cmd))
    return subprocess.run(cmd).returncode == 0


def _ensure_ollama(model: str) -> None:
    if not shutil.which("ollama"):
        if not shutil.which("brew"):
            print("  Ollama isn't installed and Homebrew wasn't found. Install Ollama from https://ollama.com")
            return
        if not _ask("  Ollama (runs the organizing model) isn't installed. Install it with Homebrew?"):
            return
        if not _run(["brew", "install", "ollama"]):
            return
    if subprocess.run(["pgrep", "-x", "ollama"], capture_output=True).returncode != 0:
        subprocess.Popen(["ollama", "serve"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if _ask(f"  Download organizing model {model} now? (several GB)"):
        _run(["ollama", "pull", model])


def _prefetch_whisper(model: str) -> None:
    if not _ask(f"  Download transcription model {model} now?"):
        return
    from huggingface_hub import snapshot_download

    snapshot_download(model)


def _prefetch_images(quantize: int) -> None:
    if not _ask(f"  Download the image model (Z-Image Turbo, {quantize}-bit) now? (several GB)"):
        return
    from .images import load_model

    load_model(quantize)


def main() -> None:
    if sys.platform != "darwin":
        print("dnd-pipeline only supports macOS for now.")
        sys.exit(1)

    current = load_config()
    print("dnd-pipeline model setup\n")

    recs: dict[str, ModelChoice]
    tier = "manual"
    if _ask("Can I check this Mac's hardware (chip, memory, free disk) to recommend models?"):
        hw = detect_hardware()
        tier = tier_for(hw)
        recs = recommend(hw)
        print(f"\n  {hw.chip}, {hw.memory_gb} GB memory, {hw.free_disk_gb} GB free disk, macOS {hw.macos}")
        print(f"  Tier: {tier}\n")
    else:
        print("\nOK, no hardware check. Pick models yourself (current choices shown as defaults).\n")
        recs = {r: ModelChoice(r, getattr(current, r)) for r in ROLES}

    models: dict[str, str | None] = {}
    for role in ROLES:
        rec = recs[role]
        shown = rec.model or "none"
        note = f"  ({rec.note})" if rec.note else ""
        print(f"{ROLE_LABELS[role]}: {shown}{note}")
        models[role] = resolve_answer(input("  Enter to accept, type a model id, or 'none': "), rec)

    cfg = config_from_choices(models, recs, tier)
    save_config(cfg)
    print("\nSaved pipeline.config.json. Re-run ./setup.sh any time to change it.\n")

    if cfg.organizing:
        _ensure_ollama(cfg.organizing)
    if cfg.transcription:
        _prefetch_whisper(cfg.transcription)
    if cfg.images:
        _prefetch_images(cfg.image_quantize)

    missing = [ROLE_LABELS[r] for r in ROLES if getattr(cfg, r) is None]
    if missing:
        print("\nNot available on this Mac: " + ", ".join(missing))
        print("The rest of the pipeline still works; those steps are skipped.")
    print("\nDone. Start everything with ./start.sh")


if __name__ == "__main__":
    main()
