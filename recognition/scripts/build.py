"""Build gate: confirm every module compiles/imports, then run the test suite.

Usage:
    python scripts/build.py

There's no compiled artifact for a Python service, so "build" here means
"prove the codebase is in a working state": every .py file parses and
imports cleanly, and the test suite passes. This is what the pre-push git
hook runs alongside lint.py.
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
    compile_status = run(sys.executable, "-m", "compileall", "-q", "app", "scripts", "tests")
    if compile_status != 0:
        print("\nBuild failed: one or more files failed to compile.")
        return 1

    test_status = run(sys.executable, "-m", "pytest", "-q")
    if test_status != 0:
        print("\nBuild failed: test suite did not pass.")
        return 1

    print("\nBuild passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
