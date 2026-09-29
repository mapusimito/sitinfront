"""Privacy gate for the local screenshot index (.work/ux-revamp/final-screens).

The folder is local working output, so this test only runs on a machine that has it.
"""
import re
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
FOLDER = ROOT / "private" / "ux-revamp" / "final-screens"
INDEX = FOLDER / "INDEX.md"

if not FOLDER.exists():
    pytest.skip(".work/ux-revamp/final-screens is not on this machine", allow_module_level=True)


def _rows():
    rows = {}
    for line in INDEX.read_text(encoding="utf-8").splitlines():
        m = re.match(r"\| `([^`]+)` \|.*\| ([^|]+) \|$", line)
        if m:
            rows[m.group(1)] = m.group(2).strip()
    return rows


def test_index_exists_and_has_rows():
    assert INDEX.exists()
    assert len(_rows()) >= 68


def test_every_jpg_is_listed_and_synthetic():
    rows = _rows()
    text = INDEX.read_text(encoding="utf-8")
    jpgs = sorted(FOLDER.glob("*.jpg"))
    assert jpgs
    for jpg in jpgs:
        state = jpg.name.split("__")[0]
        assert rows.get(state) == "synthetic", f"{jpg.name}: state not synthetic in INDEX.md"
        assert f"({jpg.name})" in text, f"{jpg.name}: not linked in INDEX.md"


def test_excluded_states_have_no_files():
    for state, result in _rows().items():
        if result != "synthetic":
            assert not list(FOLDER.glob(f"{state}__*")), f"{state} ({result}) must not have files"


def test_synthetic_states_have_all_four_images():
    for state, result in _rows().items():
        if result == "synthetic":
            for vp in ("desktop", "mobile"):
                for scheme in ("light", "dark"):
                    assert (FOLDER / f"{state}__{vp}__{scheme}.jpg").exists()


def test_folder_size_under_15mb():
    assert sum(f.stat().st_size for f in FOLDER.iterdir()) < 15 * 1024 * 1024


def test_no_working_screenshots_tracked():
    out = subprocess.run(
        ["git", "ls-files", "docs/ux-revamp/screens/"], cwd=ROOT, capture_output=True, text=True, check=True
    ).stdout
    assert ".png" not in out
