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


# ---------------------------------------------------------------------------
# Private research rule (CLAUDE.md): research documents are never tracked
# ---------------------------------------------------------------------------

_RESEARCH_PATTERNS = [
    r"^IMPLEMENTATION_STATUS\.md$", r"^HANDOFF\.md$", r"^AUDIT_REPORT.*\.md$", r"^.*_PLAN\.md$",
    r"^private/",
    r"^docs/ux-revamp/(briefs|directions|audit|final-screens)/",
    r"^docs/ux-revamp/(FINAL_REPORT|AUDIT_HANDOFF|p0-findings|p0-long-recording-result|axe-results)",
]
_IMAGE_EXT = (".png", ".jpg", ".jpeg", ".gif", ".webp")
_IMAGE_ALLOWED_PREFIXES = ("docs/screenshots/", "app/static/", "assets/")


def _tracked():
    out = subprocess.run(["git", "ls-files"], cwd=REPO_ROOT, capture_output=True, text=True, check=True).stdout
    return out.splitlines()


def test_research_documents_are_not_tracked():
    bad = [f for f in _tracked() if any(re.match(p, f) for p in _RESEARCH_PATTERNS)]
    assert not bad, f"private research must not be committed (see CLAUDE.md): {bad[:5]}"


def test_private_folder_is_gitignored():
    r = subprocess.run(["git", "check-ignore", "-q", "private/anything.md"], cwd=REPO_ROOT)
    assert r.returncode == 0, "private/ must be listed in .gitignore"


def test_tracked_images_only_in_allowed_places():
    """Screenshots of real transcripts must never reach the public repo: images are allowed only where
    the project curates them (README screenshots, app assets)."""
    bad = [f for f in _tracked() if f.lower().endswith(_IMAGE_EXT) and not f.startswith(_IMAGE_ALLOWED_PREFIXES)]
    assert not bad, f"images outside the allowed folders: {bad[:5]}"
