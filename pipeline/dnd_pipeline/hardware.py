import platform
import shutil
import subprocess
from dataclasses import dataclass


@dataclass(frozen=True)
class HardwareInfo:
    chip: str
    apple_silicon: bool
    memory_gb: int
    free_disk_gb: int
    macos: str


def _sysctl(name: str) -> str:
    return subprocess.run(["sysctl", "-n", name], capture_output=True, text=True).stdout.strip()


def detect_hardware() -> HardwareInfo:
    return HardwareInfo(
        chip=_sysctl("machdep.cpu.brand_string") or platform.processor(),
        apple_silicon=platform.machine() == "arm64",
        memory_gb=round(int(_sysctl("hw.memsize") or 0) / 1024**3),
        free_disk_gb=shutil.disk_usage("/").free // 1024**3,
        macos=platform.mac_ver()[0],
    )
