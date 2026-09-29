# Frontend scripts

Classic scripts (no modules), loaded in the order listed in `app/templates/index.html`.
They share one global scope, exactly as the old single inline `<script>` did.

Files under `engine/`, `core/format.js` and the moved functions elsewhere were cut
from `index.html` in UX revamp milestone L1 **verbatim** (same lines, same 8-space
indentation, verified by `tools/ux/split_index.py`). Do not reformat them; tests slice
function bodies by that indentation.

- `engine/`: state, chunk plan, ETA, audio slicing, transcription requests, metrics, IndexedDB run store. Frozen: presentation work must not change what text is produced or what data is sent or stored.
- `core/`: shared helpers.
- `input/`, `status/`, `transcript/`: screen code.
