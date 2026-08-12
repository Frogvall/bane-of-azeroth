#!/usr/bin/env python3
"""Run --check for every Foundry content generator."""

from __future__ import annotations

from pathlib import Path
import subprocess
import sys


def main() -> int:
    repo_root = Path(__file__).resolve().parents[1]
    generators = sorted(
        (repo_root / "tools").glob("generate-*.py")
    )

    if not generators:
        raise SystemExit(
            "No tools/generate-*.py scripts were found."
        )

    failures: list[str] = []
    for generator in generators:
        relative = generator.relative_to(repo_root)
        print(f"Checking {relative}...")
        result = subprocess.run(
            [
                sys.executable,
                str(generator),
                "--check",
            ],
            cwd=repo_root,
        )
        if result.returncode != 0:
            failures.append(str(relative))

    if failures:
        raise SystemExit(
            "Generated Foundry content is out of sync or invalid:\n  "
            + "\n  ".join(failures)
        )

    print(
        f"Verified {len(generators)} Foundry generators "
        "through their --check modes."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
