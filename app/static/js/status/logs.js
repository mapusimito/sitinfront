        async function refreshLogs() {
            try {
                const response = await fetch('/api/logs/transcriptions?limit=20');
                const data = await response.json();
                const logsList = document.getElementById('logsList');

                if (!data.logs || data.logs.length === 0) {
                    logsList.innerHTML = '<div style="color: var(--muted);">Sin registros aún</div>';
                    return;
                }

                let html = '';
                data.logs.reverse().forEach(log => {
                    const time = new Date(log.timestamp).toLocaleTimeString();
                    const status = log.status === 'success' ? '✓' : log.status === 'error' ? '✗' : '○';
                    const statusColor = log.status === 'success' ? 'var(--success)' : log.status === 'error' ? 'var(--danger)' : 'var(--warning)';
                    const duration = log.duration ? ` (${log.duration.toFixed(1)}s)` : '';
                    const error = log.error ? ` - Error: ${log.error}` : '';

                    html += `<div style="padding: 6px 0; border-bottom: 1px solid var(--line); color: var(--fg);">
                        <span style="color: ${statusColor};">${status}</span> ${time} | ${log.filename} | ${log.model}${duration}${error}
                    </div>`;
                });

                logsList.innerHTML = html;
            } catch (err) {
                const logsList = document.getElementById('logsList');
                logsList.innerHTML = `<div style="color: var(--danger);">Error al cargar registros: ${err.message}</div>`;
            }
        }
