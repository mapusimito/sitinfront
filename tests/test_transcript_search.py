"""Search, toolbar and summary tiles (T2-c): safe DOM, real metrics only, no legacy markup."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
JS = ROOT / "app/static/js/transcript"
HTML = (ROOT / "app/templates/index.html").read_text()


def test_search_and_summary_never_use_inner_html():
    for name in ("search.js", "summary.js"):
        src = (JS / name).read_text()
        assert "innerHTML" not in src and "insertAdjacentHTML" not in src, name


def test_search_has_no_global_shortcut_and_is_accent_insensitive():
    src = (JS / "search.js").read_text()
    assert "NFD" in src and "\\p{M}" in src
    assert "ctrlKey" not in src and "metaKey" not in src and "'/'" not in src


def test_toolbar_markup_and_ids_kept():
    for i in ("tvQuery", "tvCount", "tvPrev", "tvNext", "tvClear", "copyBtn", "exportBtn"):
        assert f'id="{i}"' in HTML, i
    assert 'aria-label="Buscar en la transcripción"' in HTML
    assert 'aria-live="polite"' in HTML
    assert "onclick=\"copyToClipboard()\"" in HTML and "onclick=\"exportAsFile()\"" in HTML


def test_legacy_summary_removed_and_tiles_are_real_metrics():
    assert "summary-grid" not in HTML and "summary-item" not in HTML
    css = (ROOT / "app/static/css/legacy.css").read_text()
    assert "summary-" not in css
    src = (JS / "summary.js").read_text()
    assert "sf-stat" in src
    assert "Tiempo de lectura" not in src
    for label in ("Palabras", "Duración de la clase", "Tiempo de procesamiento", "Prob. media de token", "Idioma elegido"):
        assert label in src
    assert re.search(r"calculateAverageTokenProb\(\)", src)
