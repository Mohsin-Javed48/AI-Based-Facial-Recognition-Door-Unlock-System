"""Lint gate: ruff check (style/bugs) + ruff format --check (formatting).

Usage:
    python scripts/lint.py

Exits non-zero if anything fails - this is what the pre-push git hook runs.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

RECOGNITION_ROOT = Path(__file__).resolve().parent.parent


def run(*args: str) -> int:
    print(f"$ {' '.join(args)}")
    return subprocess.call(args, cwd=RECOGNITION_ROOT)


def main() -> int:
    checks = [
        (sys.executable, "-m", "ruff", "check", "."),
        (sys.executable, "-m", "ruff", "format", "--check", "."),
    ]
    failures = 0
    for check in checks:
        if run(*check) != 0:
            failures += 1

    if failures:
        print(f"\nLint failed ({failures} check(s) failed).")
        return 1
    print("\nLint passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
