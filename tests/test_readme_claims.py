"""Cheap guards so README.md does not drift from the code (task 27.7)."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
README = (ROOT / "README.md").read_text(encoding="utf-8")


def test_no_stale_claims():
    low = README.lower()
    for word in ("lucide cdn", "bridge", "consensus", "neosun/faster-whisper", "segments stream in"):
        assert word not in low, word
    assert "Icons**: Lucide" not in README


def test_every_env_var_documented():
    env = (ROOT / ".env.example").read_text(encoding="utf-8")
    names = set(re.findall(r"^#?\s*([A-Z][A-Z0-9_]+)=", env, re.M))
    assert names
    for name in names:
        assert f"`{name}`" in README, name


def test_relative_links_resolve():
    for target in re.findall(r"\]\(([^)#\s]+)(?:#[^)]*)?\)", README):
        if re.match(r"[a-z]+:", target):
            continue
        assert (ROOT / target).exists(), target
    for target in re.findall(r'src="([^"]+)"', README):
        if not re.match(r"[a-z]+:", target):
            assert (ROOT / target).exists(), target


def test_chunk_length_matches_engine():
    state = (ROOT / "app/static/js/engine/state.js").read_text(encoding="utf-8")
    minutes = int(re.search(r"MAIN_CHUNK_DURATION\s*=\s*(\d+)\s*\*\s*60", state).group(1))
    conc = int(re.search(r"MAX_CONCURRENT_REQUESTS\s*=\s*(\d+)", state).group(1))
    mb = int(re.search(r"MAX_FILE_SIZE\s*=\s*(\d+)\s*\*\s*1024", state).group(1))
    assert f"{minutes} minute chunks" in README
    assert f"up to {conc} requests" in README
    assert f"{mb} MB" in README
