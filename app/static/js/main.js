        document.getElementById('modelSelect').addEventListener('change', (e) => {
            currentModel = e.target.value;
        });

        document.getElementById('languageSelect').addEventListener('change', (e) => {
            currentLanguage = e.target.value;
        });

        document.getElementById('contextInput').addEventListener('change', (e) => {
            currentContext = e.target.value.trim();
        });

        document.addEventListener('DOMContentLoaded', () => {
            initializeLucideIcons();
            refreshLogs();
            checkForIncompleteRun();
        });
        document.addEventListener('click', initializeLucideIcons);
