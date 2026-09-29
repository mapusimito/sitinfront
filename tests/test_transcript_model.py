"""sf.transcript unit tests (node vm, no browser)."""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def test_transcript_model_in_vm():
    out = subprocess.run(["node", str(ROOT / "tests/harness/transcript_model_test.cjs")],
                         capture_output=True, text=True, timeout=60)
    assert out.returncode == 0, out.stderr
    assert json.loads(out.stdout.strip().splitlines()[-1])["failures"] == []
