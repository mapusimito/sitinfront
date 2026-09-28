# Transcription baseline (pre-revamp)

Captured at commit `d287cec` (after the pre-L1 engine commits), by
`tools/ux/transcribe_check.mjs`: model tiny, CPU int8, language es (UI default),
files `tests/fixtures/sample_es_4min.m4a` (1 chunk) and `sample_es_12min.m4a`
(3x the 4 min file, 3 chunks). Each was run twice and the outputs were identical,
so the comparison is meaningful.

The text and run artifacts are lecture content and stay local (gitignored, same
policy as `tests/fixtures/`). Only `SHA256SUMS` is committed. To compare after a
change, rerun the script into another directory and run `shasum -a 256 -c SHA256SUMS`
from a directory laid out the same way.

    cd tools/ux
    PW_CHROME=<path to chrome-headless-shell if playwright's own build is missing> \
    node transcribe_check.mjs --file ../../tests/fixtures/sample_es_12min.m4a --out ../../docs/ux-revamp/baseline/12min
