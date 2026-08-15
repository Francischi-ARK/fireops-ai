#!/usr/bin/env python3
"""Verify that the known-dirty government source and its Git bundle are unchanged."""

from __future__ import annotations

import hashlib
import os
import subprocess
from pathlib import Path


REPO = Path(os.getenv("FIREOPS_GOVERNMENT_REPO", "/Users/francischi/.cursor/Hackathon"))
BUNDLE = Path(os.getenv(
    "FIREOPS_GOVERNMENT_BUNDLE",
    "/Users/francischi/Documents/Vibe coding/backups/fireguard-government-2026-08-09.bundle",
))
EXPECTED = {
    "head": "974fa416195e9b63d0c7183ccd8cfd5f5db52177",
    "tree": "43f55d6b2e91bb7296cbba2592d231306da87a3b",
    "tracked_diff": "e96d179a5a6a5741438a263b8b8e6571b99f60bf68633de053ddb965a8490fac",
    "status": "0e083fb75e2cbce1e8110e1fe2870ad9d27eba97a01fb255da41bf1bac52981e",
    "untracked_archive": "4dc7ecbd5d02022903f8f71ba4074ddfda1413ea6196b60bebd6a655dcbd8491",
}


def git(*args: str, cwd: Path = REPO) -> bytes:
    return subprocess.check_output(["git", *args], cwd=cwd)


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def untracked_archive_digest() -> str:
    files = subprocess.Popen(
        ["git", "ls-files", "--others", "--exclude-standard", "-z"],
        cwd=REPO,
        stdout=subprocess.PIPE,
    )
    assert files.stdout is not None
    archive = subprocess.Popen(
        ["tar", "--null", "-T", "-", "-cf", "-"],
        cwd=REPO,
        stdin=files.stdout,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    files.stdout.close()
    payload, error = archive.communicate()
    if files.wait() or archive.returncode:
        raise SystemExit(error.decode("utf-8", errors="replace"))
    return digest(payload)


def require(label: str, actual: str, expected: str):
    if actual != expected:
        raise SystemExit(f"government baseline changed: {label} {actual} != {expected}")


def main():
    if not REPO.is_dir() or not BUNDLE.is_file():
        raise SystemExit("government repository or bundle is missing")
    require("head", git("rev-parse", "HEAD").decode().strip(), EXPECTED["head"])
    require("tree", git("rev-parse", "HEAD^{tree}").decode().strip(), EXPECTED["tree"])
    require("tracked_diff", digest(git("diff", "--binary", "HEAD")), EXPECTED["tracked_diff"])
    require("status", digest(git("status", "--porcelain=v1", "-z")), EXPECTED["status"])
    require("untracked_archive", untracked_archive_digest(), EXPECTED["untracked_archive"])

    subprocess.run(["git", "bundle", "verify", str(BUNDLE)], cwd=REPO, check=True, capture_output=True)
    heads = set(git("bundle", "list-heads", str(BUNDLE)).decode().splitlines())
    expected_heads = {
        f"{EXPECTED['head']} refs/heads/main",
        f"{EXPECTED['head']} HEAD",
    }
    if heads != expected_heads:
        raise SystemExit(f"government bundle refs changed: {sorted(heads)}")
    print("government source and bundle: verified")


if __name__ == "__main__":
    main()
