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


# ---------- A0: Direction A shell, start screen, recording review, player ----------

INDEX = HTML
A0_JS = ROOT / "app" / "static" / "js"
A0_CSS = ROOT / "app" / "static" / "css"


def test_a0_header_has_one_icon_theme_button_and_no_dead_links():
    header = INDEX[INDEX.index("<header"):INDEX.index("</header>")]
    assert 'id="themeBtn"' in header and "data-theme-cycle" in header
    assert 'name="theme"' not in INDEX
    # "Mis clases" appears only now that the view exists (P3): a real link, never a dead one.
    assert 'id="classesLink" href="#/clases"' in header and 'id="viewClasses"' in INDEX
    assert 'href="#"' not in INDEX


def test_a0_start_screen_copy_and_actions():
    for text in ("Grabar clase", "Subir grabación", "Audio de hasta", "Ajustes:", "Detalles técnicos",
                 "Un modelo más grande tarda más en transcribir.", "Small · por defecto"):
        assert text in INDEX, text
    assert 'id="languageSelect"' in INDEX and 'id="modelSelect"' in INDEX
    assert '<option value="es" selected>' in INDEX and '<option value="small" selected>' in INDEX


def test_a0_model_labels_make_no_accuracy_claims():
    models = INDEX[INDEX.index('id="modelSelect"'):INDEX.index("</select>", INDEX.index('id="modelSelect"'))]
    for word in ("accurate", "precis", "mejor", "best", "strongest", "balanced"):
        assert word not in models.lower(), word


def test_a0_recording_screen_parts():
    panel = INDEX[INDEX.index('id="panelRecording"'):INDEX.index('id="panelReview"')]
    for needle in ('role="timer"', 'id="levelMeter"', 'id="stopBtn"', "Parar", 'id="safeNote"', "Nivel del micrófono"):
        assert needle in panel, needle


def test_a0_review_has_player_context_and_settings_slots():
    panel = INDEX[INDEX.index('id="panelReview"'):INDEX.index('id="panelFile"')]
    for needle in ("Escucha antes de transcribir", 'id="reviewPlayer"', 'id="slotReviewContext"',
                   'id="slotReviewSettings"', 'id="reviewTranscribeBtn"', 'id="reviewDiscardBtn"'):
        assert needle in panel, needle
    assert "¿De qué es la clase?" in INDEX
    assert "Ayuda a reconocer nombres y términos. También sirve de título." in INDEX
    assert "Seguir" not in INDEX


def test_a0_player_takes_total_from_the_passed_duration_and_revokes_urls():
    src = (A0_JS / "player" / "player.js").read_text()
    assert "sf.player" in src and "create(audioBlob, { durationSec }" in src
    assert "max=\"${total}\"" in src
    assert "audio.duration" not in src.replace("Infinity", "").replace("(element", "").split("*/", 1)[1]
    assert "URL.revokeObjectURL" in src and "root.destroy" in src
    assert '"' + '—' + '"' not in src and "—" not in src
    rec = (A0_JS / "input" / "recorder.js").read_text()
    assert "unmountReviewPlayer" in rec and "measureRecordingSeconds(blob)" in rec
    stage = (A0_JS / "input" / "stage.js").read_text()
    assert "unmountReviewPlayer" in stage


def test_a0_player_script_is_loaded_before_the_input_scripts():
    assert INDEX.index("player/player.js") < INDEX.index("input/stage.js")
    assert INDEX.index("css/player.css") < INDEX.index("css/shell.css")


def test_a0_legacy_css_has_nothing_for_replaced_regions():
    assert not (A0_CSS / "legacy.css").exists()  # F1a: the whole legacy stylesheet is gone
    assert "shell-tagline" not in INDEX and "header-log-toggle" not in INDEX and "progressToggle" not in INDEX


def test_a0_no_em_dash_in_a0_files():
    for path in (A0_CSS / "shell.css", A0_CSS / "player.css", A0_JS / "core" / "shell.js", A0_JS / "player" / "player.js",
                 A0_JS / "status" / "logs.js"):
        assert "—" not in path.read_text(), path.name


def test_a0_transcript_hidden_only_while_empty_and_not_running():
    shell = (A0_CSS / "shell.css").read_text()
    assert '#region-transcript[data-empty] { display: none; }' in shell
    assert 'id="region-transcript"' in INDEX and ' data-empty>' in INDEX


def test_a0_context_field_is_hidden_on_the_start_screen():
    """The mockup only shows "¿De qué es la clase?" on the review step and the file card.
    stage.js unhides it there; on first paint (idle) it must already be hidden."""
    assert '<div id="optContext" class="sf-field" hidden>' in INDEX
