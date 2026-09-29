"""Structural tests for the input region (UX revamp T1-a, T1-b). Behavior is covered
by tools/ux/safe_copy_check.mjs and tools/ux/keyboard_input.mjs (need a browser)."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
JS = ROOT / "app" / "static" / "js" / "input"
HTML = (ROOT / "app" / "templates" / "index.html").read_text()


def _strip_comments(src):
    return re.sub(r"//.*$", "", re.sub(r"/\*[\s\S]*?\*/", "", src), flags=re.M)


def test_safe_copy_uses_its_own_database_and_never_the_engines():
    code = _strip_comments((JS / "safe-copy.js").read_text())
    assert "sitinfront-recordings" in code
    assert "sitinfront-runs" not in code
    assert "RunStore" not in code


def test_input_code_never_writes_to_the_engine_database_directly():
    for f in JS.glob("*.js"):
        code = _strip_comments(f.read_text())
        assert "sitinfront-runs" not in code, f.name
        for forbidden in ("RunStore.createRun", "RunStore.updateChunk"):
            assert forbidden not in code, f"{f.name} calls {forbidden}"


def test_recorder_uses_timeslice_and_keeps_pipeline_call():
    code = _strip_comments((JS / "recorder.js").read_text())
    assert "mediaRecorder.start(SAFE_COPY_TIMESLICE_MS)" in code
    assert "transcribeInChunks(audioBlob, totalSeconds)" in code
    # Q11: same pieces, now labelled with the recorder's real type instead of a hardcoded 'audio/wav'.
    assert "new Blob(recordedChunks, { type: recordedType })" in code


def test_safe_copy_reassembles_in_index_order():
    code = _strip_comments((JS / "safe-copy.js").read_text())
    assert "pieces.sort((a, b) => a.index - b.index)" in code
    assert "session.mimeType" in code


def test_upload_reuses_existing_limits_and_engine_entry_point():
    code = _strip_comments((JS / "upload.js").read_text())
    assert "MAX_FILE_SIZE" in code
    assert "transcribeUploadedChunks(audioBuffer, totalSeconds, numMainChunks, file)" in code
    assert "Tiempo estimado" not in HTML and "metadataProcessingTime" not in HTML + code


def test_no_em_dash_in_input_files():
    for f in list(JS.glob("*.js")) + [ROOT / "app" / "static" / "css" / "input.css"]:
        assert "—" not in f.read_text(), f.name
    region = HTML[HTML.index('id="region-input"'):HTML.index('id="region-transcript"')]
    assert "—" not in region


def test_input_region_keeps_settings_ids_and_defaults():
    for i in ("modelSelect", "languageSelect", "contextInput", "fileInput", "statusBox"):
        assert f'id="{i}"' in HTML


def test_script_order_dependencies():
    order = ["core/events.js", "core/dialog.js", "engine/run-store.js", "input/stage.js",
             "input/safe-copy.js", "input/recorder.js", "input/upload.js", "input/resume.js"]
    idx = [HTML.index(o) for o in order]
    assert idx == sorted(idx)
    assert HTML.index("css/shell.css") < HTML.index("css/input.css")


def test_rec_color_only_in_recdot_component():
    css = (ROOT / "app" / "static" / "css" / "input.css").read_text()
    assert "var(--rec)" not in css


def test_recorded_blob_is_labelled_with_the_recorders_real_mime_type():
    """Q11: the recorder blob used to be labelled 'audio/wav' whatever the browser produced
    (Chrome makes WebM/Opus, Safari MP4/AAC). It must carry the recorder's own type."""
    recorder = (Path(__file__).parent.parent / "app" / "static" / "js" / "input" / "recorder.js").read_text()
    start = recorder.index("async function handleRecordingComplete(")
    body = recorder[start:start + 1200]
    assert "type: 'audio/wav'" not in body
    assert "recordedChunks[0]" in body and "mediaRecorder.mimeType" in body
