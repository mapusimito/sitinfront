"""D15 regression: a MediaRecorder blob whose <audio> duration is Infinity (Chrome) must produce
the same chunk plan as one whose duration is the correct finite value."""
import json
import shutil
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).parent.parent
STATIC = REPO_ROOT / "app" / "static" / "js"


def _plan_for(element_duration, decoded_duration):
    """Runs the real measureRecordingSeconds + buildChunkPlan in Node with a fake <audio>
    element reporting `element_duration` and a fake decoder returning `decoded_duration`."""
    if shutil.which("node") is None:
        pytest.skip("node not available in this environment")
    recorder = (STATIC / "input" / "recorder.js").read_text()
    start = recorder.index("async function measureRecordingSeconds(")
    end = recorder.index("async function handleRecordingComplete(", start)
    measure_src = recorder[start:end]
    chunk_plan = (STATIC / "engine" / "chunk-plan.js").read_text()
    # Guard so a regression (Infinity reaching the planner) fails fast instead of hanging.
    chunk_plan = chunk_plan.replace("chunks.push({", "if (chunks.length > 100000) throw new Error('runaway chunk plan'); chunks.push({", 1)
    script = f"""
    const MAIN_CHUNK_DURATION = 5 * 60 * 1000;
    {chunk_plan}
    {measure_src}
    global.window = global;
    global.URL = {{ createObjectURL: () => 'blob:x', revokeObjectURL() {{}} }};
    global.Audio = class {{
      set src(v) {{ this.duration = {json.dumps(element_duration) if element_duration != float('inf') else 'Infinity'}; setTimeout(() => this.onloadedmetadata(), 0); }}
    }};
    global.AudioContext = class {{
      decodeAudioData() {{ return Promise.resolve({{ duration: {decoded_duration} }}); }}
      close() {{ return Promise.resolve(); }}
    }};
    const blob = {{ arrayBuffer: async () => new ArrayBuffer(8) }};
    measureRecordingSeconds(blob).then((secs) => {{
      console.log(JSON.stringify({{ secs, plan: buildChunkPlan(secs) }}));
    }}).catch((e) => {{ console.log(JSON.stringify({{ error: e.message }})); }});
    """
    proc = subprocess.run(["node", "-e", script], capture_output=True, text=True, timeout=20)
    assert proc.returncode == 0, proc.stderr
    return json.loads(proc.stdout.strip().splitlines()[-1])


def test_infinite_element_duration_gives_same_chunk_plan_as_finite():
    finite = _plan_for(element_duration=723.4, decoded_duration=723.4)      # Firefox/Safari-like
    infinite = _plan_for(element_duration=float("inf"), decoded_duration=723.4)   # Chrome MediaRecorder
    assert "error" not in infinite, infinite
    assert infinite["secs"] == finite["secs"] == 724
    assert infinite["plan"] == finite["plan"]
    assert len(infinite["plan"]) == 3     # 5 min chunks over 12.06 min


def test_finite_duration_does_not_touch_the_decoder():
    """The fallback is limited to non-finite durations: when the element reports a usable
    duration, that value is used even if a decoder would disagree."""
    r = _plan_for(element_duration=100.2, decoded_duration=999)
    assert r["secs"] == 101


def test_zero_or_unusable_duration_also_falls_back_to_decoding():
    r = _plan_for(element_duration=0, decoded_duration=61.5)
    assert r["secs"] == 62
