#!/usr/bin/env python3
"""Validate the release deck/PDF and demo video with stdlib-first checks."""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
SUBMISSION = ROOT / "docs" / "submission"
PPTX = SUBMISSION / "FireOps-AI-GOAI-v3.pptx"
PDF = SUBMISSION / "FireOps-AI-GOAI-v3.pdf"
VIDEO = SUBMISSION / "FireOps-AI-GOAI-demo-v3.mp4"
NS = {"p": "http://schemas.openxmlformats.org/presentationml/2006/main"}


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def validate_deck() -> None:
    require(PPTX.is_file(), f"missing deck: {PPTX}")
    require(PDF.is_file(), f"missing PDF: {PDF}")

    with zipfile.ZipFile(PPTX) as archive:
        slides = sorted(
            name
            for name in archive.namelist()
            if name.startswith("ppt/slides/slide") and name.endswith(".xml")
        )
        require(len(slides) == 11, f"expected 11 PPT slides, got {len(slides)}")
        presentation = ET.fromstring(archive.read("ppt/presentation.xml"))
        size = presentation.find("p:sldSz", NS)
        require(size is not None, "missing PowerPoint slide size")
        cx, cy = int(size.attrib["cx"]), int(size.attrib["cy"])
        require(abs(cx / cy - 16 / 9) < 0.001, f"deck is not 16:9: {cx}x{cy}")
        xml_text = "".join(
            "".join(ET.fromstring(archive.read(name)).itertext()) for name in slides
        )

    for phrase in ("FireOps AI", "Modbus", "人工", "不上控"):
        require(phrase in xml_text, f"deck is missing required phrase: {phrase}")
    for phrase in ("FireGuard", "政府", "政务"):
        require(phrase not in xml_text, f"deck contains forbidden narrative: {phrase}")

    pdfinfo = shutil.which("pdfinfo")
    require(pdfinfo is not None, "pdfinfo is required to validate the PDF")
    result = subprocess.run(
        [pdfinfo, str(PDF)], check=True, capture_output=True, text=True
    )
    pages = next(
        (line.split(":", 1)[1].strip() for line in result.stdout.splitlines() if line.startswith("Pages:")),
        None,
    )
    require(pages == "11", f"expected 11 PDF pages, got {pages or 'unknown'}")
    print("submission deck: ok")


def validate_video() -> None:
    require(VIDEO.is_file(), f"missing video: {VIDEO}")
    ffprobe = shutil.which("ffprobe")
    require(ffprobe is not None, "ffprobe is required to validate the video")
    result = subprocess.run(
        [
            ffprobe,
            "-v",
            "error",
            "-show_entries",
            "format=duration:stream=codec_type,codec_name,width,height",
            "-of",
            "json",
            str(VIDEO),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    media = json.loads(result.stdout)
    duration = float(media["format"]["duration"])
    require(85 <= duration <= 95, f"video duration must be 85-95s, got {duration:.2f}s")
    streams = media["streams"]
    video = next((stream for stream in streams if stream["codec_type"] == "video"), None)
    audio = next((stream for stream in streams if stream["codec_type"] == "audio"), None)
    require(video is not None, "video stream missing")
    require(audio is not None, "audio stream missing")
    require(video.get("codec_name") == "h264", "video codec must be H.264")
    require(audio.get("codec_name") == "aac", "audio codec must be AAC")
    require((video.get("width"), video.get("height")) == (1920, 1080), "video must be 1080p")

    ffmpeg = shutil.which("ffmpeg")
    require(ffmpeg is not None, "ffmpeg is required to validate narration level")
    level = subprocess.run(
        [ffmpeg, "-hide_banner", "-i", str(VIDEO), "-af", "volumedetect", "-f", "null", "-"],
        capture_output=True,
        text=True,
    )
    max_volume_line = next((line for line in level.stderr.splitlines() if "max_volume:" in line), "")
    require(max_volume_line and "-inf" not in max_volume_line, "video narration is silent")
    print("submission video: ok")


def main() -> int:
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--deck", action="store_true")
    group.add_argument("--video", action="store_true")
    args = parser.parse_args()
    try:
        validate_deck() if args.deck else validate_video()
    except (AssertionError, OSError, subprocess.CalledProcessError, zipfile.BadZipFile) as exc:
        print(f"submission validation failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
