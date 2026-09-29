async function refreshLogs() {
  const list = document.getElementById('logsList');
  const empty = (cls, text) => {
    const d = document.createElement('div');
    d.className = cls;
    d.textContent = text;
    list.replaceChildren(d);
  };
  try {
    const response = await fetch('/api/logs/transcriptions?limit=20');
    const data = await response.json();
    if (!data.logs || data.logs.length === 0) { empty('a-log__empty', 'Sin registros aún'); return; }
    const rows = [];
    data.logs.reverse().forEach((log) => {
      const time = new Date(log.timestamp).toLocaleTimeString();
      const kind = log.status === 'success' ? 'success' : log.status === 'error' ? 'error' : 'other';
      const mark = { success: '✓', error: '✗', other: '○' }[kind];
      const duration = log.duration ? ` (${log.duration.toFixed(1)}s)` : '';
      const row = document.createElement('div');
      row.className = 'a-log__row';
      row.dataset.status = kind;
      const m = document.createElement('span');
      m.className = 'a-log__mark';
      m.textContent = mark;
      row.append(m, ` ${time} | ${log.filename} | ${log.model}${duration}`);
      if (log.error) {
        const e = document.createElement('span');
        e.className = 'a-log__err';
        e.textContent = ` - Error: ${log.error}`;
        row.appendChild(e);
      }
      rows.push(row);
    });
    list.replaceChildren(...rows);
  } catch (err) {
    empty('a-log__empty a-log__err', `Error al cargar registros: ${err.message}`);
  }
}
