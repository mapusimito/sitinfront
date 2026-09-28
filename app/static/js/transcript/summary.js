        function displaySummaryCard(processingTimeMs) {
            const wordCount = calculateWordCount();
            const readingTime = calculateReadingTime(wordCount);
            const avgTokenProb = calculateAverageTokenProb();
            const processingTime = formatProcessingTime(processingTimeMs);

            const summaryItems = [
                { icon: '', label: 'Palabras', value: wordCount.toLocaleString() },
                { icon: '', label: 'Tiempo de lectura', value: `~${readingTime} min` },
                { icon: '', label: 'Segmentos', value: totalSegments },
                { icon: '', label: 'Prob. media de token', value: avgTokenProb === null ? 'N/D' : `${Math.round(avgTokenProb * 100)}%` },
                { icon: '', label: 'Idioma', value: currentLanguage.toUpperCase() },
                { icon: '', label: 'Tiempo de procesamiento', value: processingTime }
            ];

            const summaryGrid = document.getElementById('summaryGrid');
            summaryGrid.innerHTML = summaryItems.map(item => `
                <div class="summary-item">
                    <div class="summary-item-label">${item.label}</div>
                    <div class="summary-item-value">
                        <span class="summary-item-icon">${item.icon}</span>
                        ${item.value}
                    </div>
                </div>
            `).join('');

            const summaryCard = document.getElementById('summaryCard');
            summaryCard.classList.add('active');
        }

        function hideSummaryCard() {
            const summaryCard = document.getElementById('summaryCard');
            summaryCard.classList.remove('active');
        }
