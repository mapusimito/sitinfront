"""P2 gates: the synchronized player wiring stays honest and safe."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PLAYER = (ROOT / "app/static/js/player/transcript-player.js").read_text(encoding="utf-8")
READER = (ROOT / "app/static/js/transcript/reader.js").read_text(encoding="utf-8")
HTML = (ROOT / "app/templates/index.html").read_text(encoding="utf-8")


def test_player_attaches_on_run_end_and_detaches():
    assert "sf.events.on('run:start'" in PLAYER and "detach()" in PLAYER
    assert "'complete'" in PLAYER and "'partial'" in PLAYER
    assert "durationExactSec" in PLAYER  # stored duration, never the element's


def test_no_dead_controls_before_player():
    # Timestamps are buttons only when a player is attached; gap audio sentence only then.
    assert "if (player) {" in READER and "createElement('time'" in READER or "el('time'" in READER
    assert "El audio de este tramo sí se puede escuchar." in READER
    assert "Reproducir desde" in READER


def test_shortcuts_and_toolbar_markup():
    assert "aria-keyshortcuts" in PLAYER
    assert 'aria-label="Copiar transcripción"' in HTML and 'aria-label="Exportar .txt"' in HTML
    assert "transcript-player.js" in HTML and 'id="tvDock"' in HTML
