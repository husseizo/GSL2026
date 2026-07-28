#!/usr/bin/env python3
"""Validate every fenced ```mermaid block in the repository's Markdown
files by rendering each one with mermaid-cli (mmdc). Renders to a
throwaway temp file and discards it immediately — this validates syntax
only, it never publishes or commits a rendered image.

Used by .github/workflows/docs-mermaid-check.yml. Exits non-zero if any
block fails to parse, printing a GitHub Actions-formatted error
annotation naming the exact file.
"""
import os
import re
import subprocess
import sys
import tempfile

MERMAID_BLOCK = re.compile(r"```mermaid\n(.*?)```", re.DOTALL)
SKIP_DIRS = {"node_modules", ".git", "dist", "build", "__pycache__"}


def find_markdown_files(root: str):
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for name in filenames:
            if name.endswith(".md"):
                yield os.path.join(dirpath, name)


def validate_block(path: str, index: int, block: str) -> bool:
    with tempfile.NamedTemporaryFile(mode="w", suffix=".mmd", delete=False, encoding="utf-8") as f:
        f.write(block)
        tmp_in = f.name
    tmp_out = tmp_in + ".svg"
    try:
        result = subprocess.run(
            ["mmdc", "-i", tmp_in, "-o", tmp_out],
            capture_output=True,
            text=True,
            timeout=60,
        )
        if result.returncode != 0:
            print(f"::error file={path}::Mermaid block {index} failed to parse:\n{result.stderr}")
            return False
        return True
    finally:
        for p in (tmp_in, tmp_out):
            if os.path.exists(p):
                os.unlink(p)


def main() -> int:
    root = "."
    ok = True
    checked = 0
    for path in find_markdown_files(root):
        text = open(path, encoding="utf-8").read()
        blocks = MERMAID_BLOCK.findall(text)
        for i, block in enumerate(blocks, start=1):
            checked += 1
            if not validate_block(path, i, block):
                ok = False
    print(f"Checked {checked} mermaid block(s).")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
