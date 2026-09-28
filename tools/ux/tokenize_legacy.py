"""One-off L3 helper: rewrite legacy.css (and the few inline colors elsewhere) onto design tokens."""
import re
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
css_p = ROOT / "app/static/css/legacy.css"
s = css_p.read_text()

# 1. Drop what the shell now owns: :root block, body, .container, .header*, .grid.
def cut(s, start_pat, end_pat):
    a = re.search(start_pat, s); b = re.search(end_pat, s)
    assert a and b and a.start() < b.start(), (start_pat, end_pat)
    return s[:a.start()] + s[b.start():]
s = cut(s, r"        :root \{", r"        \* \{")
s = cut(s, r"        body \{", r"        \.card \{")   # body, .container, .header*, .grid, @media
s = s.replace("@keyframes blink", "@keyframes blink")  # kept: other rules may use it

# 2. Context-aware yellow.
def yellow(m):
    prop = m.group(1)
    if prop.strip() == "color" or prop.strip() in ("fill", "stroke"):
        return f"{m.group(0).replace('var(--foco)', 'var(--accent-text)')}"
    if prop.strip().startswith(("border", "outline")):
        return m.group(0).replace("var(--foco)", "var(--accent-edge)")
    return m.group(0)
s = re.sub(r"^(\s*(?:color|fill|stroke|border[\w-]*|outline[\w-]*))\s*:[^;{}]*var\(--foco\)[^;{}]*;", yellow, s, flags=re.M)

# 3. Straight substitutions.
subs = [
 (r"#2A2A27|#1A1A18", "var(--line)"),
 (r"#555552", "var(--muted)"),
 (r"rgba\(59, 59, 56, 0\.2\)", "color-mix(in srgb, var(--muted) 12%, transparent)"),
 (r"rgba\(59, 59, 56, 0\.9\)", "var(--panel)"),
 (r"rgba\(242, 255, 0, 0\.05\)", "color-mix(in srgb, var(--accent-text) 6%, transparent)"),
 (r"rgba\(242, 255, 0, 0\.1\)", "color-mix(in srgb, var(--accent-text) 10%, transparent)"),
 (r"rgba\(242, 255, 0, 0\.2\)", "color-mix(in srgb, var(--accent-text) 20%, transparent)"),
 (r"rgba\(242, 255, 0, 0\.9\)", "color-mix(in srgb, var(--accent) 90%, transparent)"),
 (r"rgba\(255, 255, 255, 0\.2\)", "color-mix(in srgb, var(--fg) 20%, transparent)"),
 (r"rgba\(255, 255, 255, 0\.3\)", "color-mix(in srgb, var(--fg) 30%, transparent)"),
 (r"rgba\(0, 0, 0, 0\.5\)", "var(--overlay)"),
 (r"var\(--secondary-text-2\)|var\(--secondary-text\)", "var(--muted)"),
 (r"var\(--papel\)", "var(--fg)"),
 (r"'IBM Plex Mono', monospace", "var(--font-mono)"),
 (r"'Schibsted Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", "var(--font-sans)"),
]
for pat, rep in subs:
    s = re.sub(pat, rep, s)
css_p.write_text(s)

# 4. Inline colors in the moved JS and the page.
def edit(rel, pairs):
    p = ROOT / rel; t = p.read_text()
    for a, b in pairs:
        assert a in t, (rel, a); t = t.replace(a, b)
    p.write_text(t)
edit("app/static/js/status/logs.js", [
    ("'#4CAF50'", "'var(--success)'"), ("'#FFA500'", "'var(--warning)'"), ("'#FF3B30'", "'var(--danger)'"),
    ("border-bottom: 1px solid #1A1A18", "border-bottom: 1px solid var(--line)"),
    ("color: #FF3B30", "color: var(--danger)"), ("var(--papel)", "var(--fg)"), ("var(--secondary-text)", "var(--muted)")])
edit("app/static/js/transcript/segment.js", [("color: #64748b", "color: var(--muted)")])
print("done")
