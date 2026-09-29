"""Transcript rendering must never parse model text as HTML (T2-b)."""
import re
from pathlib import Path

JS = Path(__file__).resolve().parent.parent / "app/static/js/transcript"


def test_no_inner_html_in_transcript_rendering():
    for name in ("segment.js", "reader.js"):
        src = (JS / name).read_text()
        assert not re.search(r"innerHTML\s*=\s*[^'\"\s;]", src) and "insertAdjacentHTML" not in src, name
        assert not re.search(r"innerHTML\s*=\s*`[^`]*\$\{", src), name


def test_reader_uses_text_content_and_no_forbidden_labels():
    src = (JS / "reader.js").read_text()
    assert "textContent" in src
    for word in ("precisión", "confianza"):
        assert word not in src
