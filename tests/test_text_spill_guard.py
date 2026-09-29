"""P4: the text-spill guard exists and is wired into the axe sweep."""
from pathlib import Path

UX = Path(__file__).resolve().parent.parent / "tools" / "ux"


def test_guard_files_exist():
    assert (UX / "text_spill_lib.mjs").is_file()
    assert (UX / "text_spill_check.mjs").is_file()


def test_guard_covers_required_elements():
    lib = (UX / "text_spill_lib.mjs").read_text()
    for token in ("button", ".sf-badge", ".sf-stat", "summary", "label", "input[placeholder]", "scrollWidth", "overlap"):
        assert token in lib


def test_guard_wired_into_screens():
    screens = (UX / "screens.mjs").read_text()
    assert "text_spill_lib.mjs" in screens and "spillScan" in screens


def test_no_global_button_flex_rule():
    base = (UX.parent.parent / "app" / "static" / "css" / "base.css").read_text()
    assert "min-width: 100px" not in base
