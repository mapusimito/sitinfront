        async function refreshLogs() {
            try {
                const response = await fetch('/api/logs/transcriptions?limit=20');
                const data = await response.json();
                const logsList = document.getElementById('logsList');

                if (!data.logs || data.logs.length === 0) {
                    logsList.innerHTML = '<div style="color: var(--secondary-text);">Sin registros aún</div>';
                    return;
                }

                let html = '';
                data.logs.reverse().forEach(log => {
                    const time = new Date(log.timestamp).toLocaleTimeString();
                    const status = log.status === 'success' ? '✓' : log.status === 'error' ? '✗' : '○';
                    const statusColor = log.status === 'success' ? '#4CAF50' : log.status === 'error' ? '#FF3B30' : '#FFA500';
                    const duration = log.duration ? ` (${log.duration.toFixed(1)}s)` : '';
                    const error = log.error ? ` - Error: ${log.error}` : '';

                    html += `<div style="padding: 6px 0; border-bottom: 1px solid #1A1A18; color: var(--papel);">
                        <span style="color: ${statusColor};">${status}</span> ${time} | ${log.filename} | ${log.model}${duration}${error}
                    </div>`;
                });

                logsList.innerHTML = html;
            } catch (err) {
                const logsList = document.getElementById('logsList');
                logsList.innerHTML = `<div style="color: #FF3B30;">Error al cargar registros: ${err.message}</div>`;
            }
        }
