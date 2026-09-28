import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(REPO_ROOT / "scripts"))

import analyze_run  # noqa: E402


def _segment(text, start, end, avg_logprob=-0.2, compression_ratio=1.1):
    return {"text": text, "start": start, "end": end, "avg_logprob": avg_logprob,
            "compression_ratio": compression_ratio, "no_speech_prob": 0.05, "temperature": 0.0}


def test_flags_repeated_phrase():
    repeated = " ".join(["muchas gracias por su atencion"] * 10)
    text = repeated
    findings = analyze_run.find_repeated_phrases(text)
    assert any("muchas gracias por" in phrase for phrase, _ in findings)


def test_flags_low_word_count_chunk(tmp_path, capsys):
    artifact = {
        "run_id": "synthetic-run",
        "model": "large-v3-turbo",
        "device": "cpu",
        "compute_type": "int8",
        "chunks": [
            {
                "index": 0, "type": "main", "duration": 60.0,
                "segments": [_segment("word " * 200, 0, 60)],
            },
            {
                "index": 1, "type": "main", "duration": 60.0,
                "segments": [_segment("apenas cinco palabras aqui nada", 0, 60)],
            },
        ],
    }
    path = tmp_path / "synthetic.json"
    path.write_text(json.dumps(artifact))

    analyze_run.analyze(artifact)
    out = capsys.readouterr().out
    assert "LOW WPM" in out
    assert "chunk 1" in out
