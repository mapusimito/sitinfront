        function copyToClipboard() {
            const text = sf.transcript.toText();
            navigator.clipboard.writeText(text).then(() => {
                sf.toast({ kind: 'success', title: 'Copiado al portapapeles' });
            });
        }

        function exportAsFile() {
            const text = sf.transcript.toText();
            const blob = new Blob([text], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `transcript-${new Date().toISOString().slice(0, 10)}.txt`;
            a.click();
            URL.revokeObjectURL(url);
            sf.toast({ kind: 'success', title: 'Archivo descargado' });
        }
