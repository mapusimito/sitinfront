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


def test_container_files_follow_server_defaults():
    docker = (ROOT / "Dockerfile").read_text(encoding="utf-8")
    compose = (ROOT / "docker-compose.yml").read_text(encoding="utf-8")
    start = (ROOT / "start.sh").read_text(encoding="utf-8")
    for name, text in (("Dockerfile", docker), ("docker-compose.yml", compose), ("start.sh", start)):
        assert "neosun" not in text.lower(), name
    assert "image: sitinfront:" in compose
    # DEVICE, COMPUTE_TYPE and MODEL_SIZE must not be given a value here: server.py decides.
    assert not re.search(r"^\s*ENV\s+.*\b(DEVICE|COMPUTE_TYPE|MODEL_SIZE)=", docker, re.M)
    assert not re.search(r"(DEVICE|COMPUTE_TYPE|MODEL_SIZE)=\$\{[A-Z_]+:-", compose)
    assert not re.search(r"export\s+(DEVICE|COMPUTE_TYPE|MODEL_SIZE)=", start)
    assert "pip install --upgrade pip" in docker
    assert "docker build -t sitinfront:local ." in README
    assert "planned" not in README.lower().split("### docker")[1].split("## configuration")[0]
