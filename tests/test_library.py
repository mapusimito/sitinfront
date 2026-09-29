"""P3 gates: "Mis clases" stays safe (no innerHTML), routed and honest."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LIB = (ROOT / "app/static/js/library/library.js").read_text(encoding="utf-8")
ROUTER = (ROOT / "app/static/js/library/router.js").read_text(encoding="utf-8")
MODEL = (ROOT / "app/static/js/transcript/model.js").read_text(encoding="utf-8")
HTML = (ROOT / "app/templates/index.html").read_text(encoding="utf-8")


def test_no_innerhtml_with_user_text():
    for src in (LIB, ROUTER):
        assert "innerHTML" not in src and "insertAdjacentHTML" not in src


def test_routes_and_lock_texts():
    assert "#/clases" in ROUTER and "hashchange" in ROUTER
    assert "Disponible cuando termine la transcripción" in ROUTER
    assert "Disponible cuando pares la grabación" in ROUTER
    assert 'aria-describedby="classesLinkWhy"' in HTML and 'href="#/clases"' in HTML


def test_class_flow_wiring():
    assert "loadClass" in MODEL and "seedFromRecord(rec)" in MODEL  # fallback for records without segments
    assert "RunStore.saveClass(c.runId, { name: v })" in LIB  # rename merges, never rewrites the record
    assert "danger: true" in LIB and "No se puede deshacer." in LIB
    assert "Guardado en este navegador." in LIB
    assert "No encontramos esa clase" in HTML
    assert "/static/js/library/router.js" in HTML and "/static/css/library.css" in HTML


def test_header_status_pill_wraps_to_its_own_row_on_small_screens():
    """Regression (found by the lead's final axe run): logo + "Mis clases" link + theme button + a long
    status pill overflowed 375 px by 12 px once P3 added the link. The pill must move to its own row."""
    from pathlib import Path
    css = (Path(__file__).parent.parent / "app" / "static" / "css" / "components.css").read_text()
    start = css.index("@media (max-width: 40rem)", css.index(".sf-head__pill[hidden]"))
    block = css[start:css.index("/* ---------- Disclosure", start)]
    assert ".sf-head { flex-wrap: wrap; }" in block
    assert ".sf-head__status:has(.sf-head__pill:not([hidden]))" in block and "flex: 1 0 100%" in block
