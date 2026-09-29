"""P1b unit tests (node vm, no browser)."""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def test_persist_in_vm():
    out = subprocess.run(["node", str(ROOT / "tests/harness/persist_test.cjs")],
                         capture_output=True, text=True, timeout=60)
    assert out.returncode == 0, out.stderr
    assert json.loads(out.stdout.strip().splitlines()[-1])["failures"] == []


def test_engine_calls_after_save_once():
    src = (ROOT / "app/static/js/engine/transcribe.js").read_text()
    assert src.count("sf.storage.afterSave()") == 1
    assert "RunStore.saveClass(runId, meta).then(() => sf.storage.afterSave())" in src
