"""Repository hygiene: secrets-shaped files stay untracked and the env template stays complete."""
import re
import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent


def test_dot_env_is_not_tracked():
    """A tracked .env is picked up by `docker compose` for ${VAR} substitution on every clone."""
    out = subprocess.run(["git", "ls-files", ".env"], cwd=REPO_ROOT, capture_output=True, text=True).stdout
    assert out.strip() == "", ".env must stay untracked (only .env.example is committed)"


def _env_vars_read_by_the_app():
    names = set()
    for path in (REPO_ROOT / "app").glob("*.py"):
        text = path.read_text()
        names |= set(re.findall(r"os\.(?:environ\.get|getenv)\(\s*[\"']([A-Z][A-Z0-9_]+)[\"']", text))
    return names


def test_env_example_lists_every_variable_the_app_reads():
    example = (REPO_ROOT / ".env.example").read_text()
    documented = set(re.findall(r"^#?\s*([A-Z][A-Z0-9_]+)=", example, re.M))
    missing = _env_vars_read_by_the_app() - documented
    assert not missing, f".env.example is missing: {sorted(missing)}"


def test_env_example_has_no_inline_comments_after_values():
    """`docker run --env-file` keeps everything after '=' as the value, comment included."""
    for line in (REPO_ROOT / ".env.example").read_text().splitlines():
        if re.match(r"^[A-Z][A-Z0-9_]+=", line):
            assert " #" not in line, f"inline comment would become part of the value: {line}"
