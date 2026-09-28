// Applies the same normalization transcribe_check.mjs uses to an artifact that
// was captured before the chunk-order sort existed. Usage: node normalize_artifact.mjs <file>
import fs from 'node:fs';
const f = process.argv[2];
const art = JSON.parse(fs.readFileSync(f, 'utf8'));
if (art.chunks) art.chunks.sort((a, b) => a.index - b.index);
fs.writeFileSync(f, JSON.stringify(art, null, 2) + '\n');
