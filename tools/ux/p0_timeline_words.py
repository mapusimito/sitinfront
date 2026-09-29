"""P0 Q4 (word level): does chunk.start_ms/1000 + word.start land on the ORIGINAL timeline after VAD?

The 12 min fixture is the 4 min fixture x3 (period 240 s). The app cuts chunks at 300 s and 600 s, so the
repeats straddle chunk boundaries. We send the 4 min file as ONE chunk (reference, offset 0) and the 12 min file
as the app's three 16 kHz mono WAV chunks (0-300, 300-600, 600-720 s), both with vad_filter=true, batched
(default batch_size 16), tiny model, word_timestamps=true (API called directly, no run artifact is written).
Words that the two transcriptions agree on (difflib matching blocks of >= 3 words) are compared:
    error = (chunk_offset + word.start) - (ref_word.start + 240 * period)
usage: p0_timeline_words.py <server_url> <workdir>
"""
import json, subprocess, sys, difflib, statistics as st, os, re
url, work = sys.argv[1].rstrip('/'), sys.argv[2]
fx = os.path.join(os.path.dirname(__file__), '../../tests/fixtures')
os.makedirs(work, exist_ok=True)

def post(path):
    out = subprocess.run(['curl', '-s', f'{url}/v1/audio/transcriptions', '-F', f'file=@{path}', '-F', 'model=tiny', '-F', 'language=es',
                          '-F', 'response_format=verbose_json', '-F', 'word_timestamps=true', '-F', 'vad_filter=true'], capture_output=True, text=True).stdout
    return json.loads(out)

def words(resp, off):
    return [(re.sub(r'\W+', '', w['word'].lower()), off + w['start'], off + w['end']) for s in resp['segments'] for w in (s['words'] or [])]

ref = words(post(os.path.join(fx, 'sample_es_4min.m4a')), 0.0)
big = []
for i, (a, b) in enumerate([(0, 300), (300, 600), (600, 720)]):
    p = os.path.join(work, f'chunk{i}.wav')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(a), '-t', str(b - a), '-i', os.path.join(fx, 'sample_es_12min.m4a'), '-ac', '1', '-ar', '16000', p], check=True)
    big.append((i, a, words(post(p), float(a))))
print('reference words:', len(ref), ' chunk words:', [len(c[2]) for c in big])

R = [w[0] for w in ref]
rows = []
for period in range(3):
    lo, hi = 240 * period, 240 * period + 240
    seq = [(ci, w) for ci, a, ws in big for w in ws if lo <= w[1] < hi]
    A = [w[0] for _, w in seq]
    sm = difflib.SequenceMatcher(None, R, A, autojunk=False)
    for m in sm.get_matching_blocks():
        if m.size < 3: continue
        for k in range(m.size):
            rw, (ci, bw) = ref[m.a + k], seq[m.b + k]
            rows.append((period, ci, bw[1] - (rw[1] + 240 * period), bw[2] - (rw[2] + 240 * period), bw[1]))
print('matched words:', len(rows))
for period in range(3):
    for ci in range(3):
        e = [abs(r[2]) for r in rows if r[0] == period and r[1] == ci]
        if e: print(f'period {period} (abs {240*period}-{240*period+240}s), words from chunk {ci}: n={len(e)} median|err|={st.median(e):.2f}s p90={sorted(e)[int(.9*(len(e)-1))]:.2f}s max={max(e):.2f}s')
e = [abs(r[2]) for r in rows]; s = [r[2] for r in rows]
print(f'ALL: n={len(e)} median|err|={st.median(e):.2f}s p90={sorted(e)[int(.9*(len(e)-1))]:.2f}s p99={sorted(e)[int(.99*(len(e)-1))]:.2f}s max={max(e):.2f}s mean signed={st.mean(s):+.2f}s')
print('share within 0.5 s: %.1f%%   within 1 s: %.1f%%' % (100 * sum(x <= .5 for x in e) / len(e), 100 * sum(x <= 1 for x in e) / len(e)))
worst = sorted(rows, key=lambda r: -abs(r[2]))[:5]
print('worst 5 (period, chunk, err_start, err_end, abs_start):', [(a, b, round(c, 2), round(d, 2), round(f, 1)) for a, b, c, d, f in worst])
