/*
 * Summary tiles (T2-c). One sf-stat per real metric. Words and duration come
 * from the transcript model, processing time is measured by the engine,
 * Prob. media de token comes from calculateAverageTokenProb(), the language
 * is the one the user selected (never a detection). Built with DOM nodes only.
 */
        function summaryHms(seconds) {
            const t = Math.floor(Math.max(0, seconds));
            const p = (n) => String(n).padStart(2, '0');
            return `${p(Math.floor(t / 3600))}:${p(Math.floor((t % 3600) / 60))}:${p(t % 60)}`;
        }

        function summaryModelWords() {
            if (typeof sf === 'undefined' || !sf.transcript) return calculateWordCount();
            let words = 0;
            for (const s of sf.transcript.get().segments) {
                if (s.gap) continue;
                const t = s.text.trim();
                if (t) words += t.split(/\s+/).length;
            }
            return words;
        }

        function summaryLanguageName() {
            const sel = document.getElementById('languageSelect');
            if (sel && sel.options && sel.selectedIndex >= 0 && sel.options[sel.selectedIndex]) {
                return sel.options[sel.selectedIndex].textContent.trim();
            }
            return currentLanguage.toUpperCase();
        }

        function displaySummaryCard(processingTimeMs) {
            const avgTokenProb = calculateAverageTokenProb();
            const meta = (typeof sf !== 'undefined' && sf.transcript) ? sf.transcript.get().meta : null;
            const tiles = [
                { label: 'Palabras', value: summaryModelWords().toLocaleString('es-ES') },
            ];
            if (meta && Number.isFinite(meta.totalSeconds)) {
                tiles.push({ label: 'Duración de la clase', value: summaryHms(meta.totalSeconds), mono: true });
            }
            tiles.push({ label: 'Tiempo de procesamiento', value: formatProcessingTime(processingTimeMs), mono: true });
            tiles.push({
                label: 'Prob. media de token',
                value: avgTokenProb === null ? 'N/D' : `${Math.round(avgTokenProb * 100)} %`,
                describedBy: 'tvTileHelp',
            });
            tiles.push({ label: 'Idioma elegido', value: summaryLanguageName() });

            const card = document.getElementById('summaryCard');
            card.textContent = '';
            for (const t of tiles) {
                const tile = document.createElement('div');
                tile.className = 'sf-stat';
                const label = document.createElement('div');
                label.className = 'sf-stat__label';
                label.textContent = t.label;
                const value = document.createElement('div');
                value.className = t.mono ? 'sf-stat__value sf-mono' : 'sf-stat__value';
                value.textContent = t.value;
                if (t.describedBy) tile.setAttribute('aria-describedby', t.describedBy);
                tile.appendChild(label);
                tile.appendChild(value);
                card.appendChild(tile);
            }
            card.classList.add('active');
        }

        function hideSummaryCard() {
            const summaryCard = document.getElementById('summaryCard');
            summaryCard.classList.remove('active');
        }
