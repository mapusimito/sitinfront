"""P0 Q4: do faster-whisper segment times (chunk.start_ms/1000 + segment.start) sit on the original audio timeline?

usage: p0_timeline.py <artifact_4min.json> <artifact_12min.json>

The 12 min fixture is the 4 min fixture repeated 3 times (period exactly 240 s) while the app cuts chunks at
300 s and 600 s. For every 12 min segment with usable text we find the best matching segment in the 4 min run
(single chunk, offset 0, so its times are already on the original timeline) and compute
    error = (chunk.start_ms/1000 + seg.start) - (ref.start + 240*k)   with k = round(diff/240).
Segment boundaries can legitimately differ between runs (different windows), so this is an upper bound
on the timeline error, not a pure offset measurement.
"""
import json, sys, difflib, statistics as st

def load(p):
    a = json.load(open(p)); out = []
    for c in sorted(a['chunks'], key=lambda c: c['index']):
        for s in c['segments']:
            out.append(dict(chunk=c['index'], off=c['start_ms'] / 1000, rel=s['start'], relend=s['end'], abs=c['start_ms'] / 1000 + s['start'], absend=c['start_ms'] / 1000 + s['end'], text=s['text'], cr=s['compression_ratio']))
    return out

ref = load(sys.argv[1]); big = load(sys.argv[2])
good = lambda s: s['cr'] < 2.0 and len(s['text']) > 40
rows = []
for s in big:
    if not good(s): continue
    best = max((r for r in ref if good(r)), key=lambda r: difflib.SequenceMatcher(None, s['text'], r['text']).ratio(), default=None)
    if not best: continue
    ratio = difflib.SequenceMatcher(None, s['text'], best['text']).ratio()
    if ratio < 0.4: continue
    d = s['abs'] - best['abs']; k = round(d / 240); err = d - 240 * k
    dend = s['absend'] - best['absend']; kend = round(dend / 240); errend = dend - 240 * kend
    rows.append((s['chunk'], round(s['abs'], 2), round(best['abs'], 2), k, round(err, 2), round(errend, 2), round(ratio, 2), s['text'][:45]))
print('chunk abs_start ref_start k err_start err_end sim text')
for r in rows: print(*r)
if rows:
    e = [abs(r[4]) for r in rows]; ee = [abs(r[5]) for r in rows]
    print(f'\nmatched {len(rows)} of {sum(good(s) for s in big)} usable 12min segments')
    print('start error |s|: median %.2f  p90 %.2f  max %.2f' % (st.median(e), sorted(e)[int(0.9 * (len(e) - 1))], max(e)))
    print('end   error |s|: median %.2f  max %.2f' % (st.median(ee), max(ee)))
    for ch in sorted({r[0] for r in rows}):
        ec = [abs(r[4]) for r in rows if r[0] == ch]
        print(f'  chunk {ch}: n={len(ec)} median {st.median(ec):.2f} max {max(ec):.2f}')
