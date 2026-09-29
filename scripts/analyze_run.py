#!/usr/bin/env python3
"""Analyze a run artifact (runs/<run_id>.json) produced by app/server.py.

Read-only: this script changes nothing in the pipeline. It exists so a run can be
compared against others after the fact.

Usage:
    python3 scripts/analyze_run.py runs/<run_id>.json
"""

import argparse
import json
import re
import statistics
import sys
from pathlib import Path


def words_per_minute(chunk: dict) -> float:
    text = " ".join(s["text"] for s in chunk.get("segments", []))
    word_count = len(text.split())
    duration = chunk.get("duration") or 0.0
    if duration <= 0:
        return 0.0
    return word_count / (duration / 60.0)


def find_repeated_phrases(text: str, min_words=3, max_words=5, min_repeats=4):
    """Find n-gram (3-5 word) sequences repeated >= min_repeats times within the text."""
    words = text.split()
    findings = []
    for n in range(min_words, max_words + 1):
        seen = {}
        for i in range(len(words) - n + 1):
            phrase = " ".join(words[i : i + n]).lower()
            seen.setdefault(phrase, []).append(i)
        for phrase, positions in seen.items():
            if len(positions) >= min_repeats:
                findings.append((phrase, len(positions)))
    # De-duplicate: prefer the longest phrase when shorter ones are substrings of it.
    findings.sort(key=lambda f: (-len(f[0]), -f[1]))
    deduped = []
    for phrase, count in findings:
        if not any(phrase in kept_phrase for kept_phrase, _ in deduped):
            deduped.append((phrase, count))
    return deduped


def analyze(artifact: dict):
    chunks = artifact.get("chunks", [])
    if not chunks:
        print("No chunks in this run artifact.")
        return

    wpm_values = [words_per_minute(c) for c in chunks]
    median_wpm = statistics.median([w for w in wpm_values if w > 0]) if any(wpm_values) else 0.0

    print(f"Run: {artifact.get('run_id')}  model={artifact.get('model')}  "
          f"device={artifact.get('device')}  compute_type={artifact.get('compute_type')}")
    print(f"Chunks: {len(chunks)}   Median WPM: {median_wpm:.1f}\n")

    for i, chunk in enumerate(chunks):
        segs = chunk.get("segments", [])
        text = " ".join(s["text"] for s in segs)
        wpm = wpm_values[i]
        max_cr = max((s.get("compression_ratio") or 0 for s in segs), default=0)
        min_lp = min((s.get("avg_logprob") for s in segs if s.get("avg_logprob") is not None), default=None)

        flags = []
        if median_wpm > 0 and wpm < median_wpm * 0.5:
            flags.append(f"LOW WPM ({wpm:.1f} vs median {median_wpm:.1f})")

        repeats = find_repeated_phrases(text)
        for phrase, count in repeats:
            flags.append(f'REPEATED PHRASE x{count}: "{phrase}"')

        label = f"chunk {chunk.get('index')} ({chunk.get('type')})"
        print(f"[{label}] wpm={wpm:.1f} max_compression_ratio={max_cr:.2f} "
              f"min_avg_logprob={min_lp if min_lp is not None else 'N/A'}")
        for flag in flags:
            print(f"    ! {flag}")

    print()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("artifact_path", type=Path, help="Path to a runs/<run_id>.json artifact")
    args = parser.parse_args()

    artifact = json.loads(args.artifact_path.read_text())
    analyze(artifact)


if __name__ == "__main__":
    main()
