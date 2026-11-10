// ============================================================================
// Lexispelling V2 - Final Report View (Informe Final)
// Detailed diagnostics, failed letters highlighted in vivid red, performance KPIs
// ============================================================================

class ReportView {
  static render() {
    const container = document.getElementById('view-report');
    if (!container) return;

    const session = window.store.get('studySession');
    const profile = window.store.get('profile') || { displayName: 'Estudiante' };

    if (!session || !session.sessionResults || session.sessionResults.length === 0) {
      window.app.navigate('library');
      return;
    }

    const results = session.sessionResults;
    const totalWords = results.length;
    const correctCount = results.filter(r => r.completedSuccessfully).length;
    const accuracyPct = Math.round((correctCount / totalWords) * 100);

    const totalSeconds = results.reduce((acc, r) => acc + (r.timeSeconds || 0), 0);
    const avgSpeed = (totalSeconds / totalWords).toFixed(1);

    // Hardest & fastest words
    const sortedByTime = [...results].sort((a, b) => (b.timeSeconds || 0) - (a.timeSeconds || 0));
    const hardestWord = sortedByTime[0];
    const fastestWord = sortedByTime[sortedByTime.length - 1];

    const todayDateFormatted = new Date().toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const deckNamesList = (session.deckNames || []).join(', ') || 'Varios';

    let html = `
      <div class="report-container">
        <!-- Header -->
        <div class="report-header">
          <h2 style="font-size: 24px; font-weight: 800; color: #fff;">Informe Final Consolidado</h2>
          <div class="report-meta-row">
            <span>📅 ${todayDateFormatted}</span>
            <span>👤 Alumno: <strong>${profile.displayName}</strong></span>
            <span>📚 Mazos: <strong>${deckNamesList}</strong></span>
          </div>
        </div>

        <!-- 4 Stat KPIs -->
        <div class="report-stats-grid">
          <div class="report-stat-card">
            <span class="stat-card-label">Precisión Global</span>
            <span class="stat-card-value" style="color: ${accuracyPct >= 80 ? 'var(--success)' : accuracyPct >= 50 ? 'var(--warning)' : 'var(--error)'};">
              ${accuracyPct}%
            </span>
            <span class="stat-card-sub">${correctCount} de ${totalWords} correctas</span>
          </div>

          <div class="report-stat-card">
            <span class="stat-card-label">Velocidad Media</span>
            <span class="stat-card-value mono">${avgSpeed}s</span>
            <span class="stat-card-sub">Tiempo medio por palabra</span>
          </div>

          <div class="report-stat-card">
            <span class="stat-card-label">Récord de Velocidad</span>
            <span class="stat-card-value mono" style="color: var(--accent-cyan); font-size: 20px;">
              ${fastestWord ? fastestWord.word : '-'}
            </span>
            <span class="stat-card-sub">${fastestWord ? fastestWord.timeSeconds + 's' : ''}</span>
          </div>

          <div class="report-stat-card">
            <span class="stat-card-label">Palabra Desafío</span>
            <span class="stat-card-value mono" style="color: var(--warning); font-size: 20px;">
              ${hardestWord ? hardestWord.word : '-'}
            </span>
            <span class="stat-card-sub">${hardestWord ? hardestWord.timeSeconds + 's' : ''}</span>
          </div>
        </div>

        <!-- Detailed Results Table -->
        <div class="report-table-card">
          <table class="report-table">
            <thead>
              <tr>
                <th>Palabra (Diagnóstico)</th>
                <th>Orig.</th>
                <th>Tiempo</th>
                <th>Re-Quiz</th>
                <th>Evolución</th>
              </tr>
            </thead>
            <tbody>
    `;

    results.forEach(row => {
      // Highlight failed letters in vivid bright bold red! (Section 4.6)
      const wordHtml = ReportView.renderWordWithFailedLetters(row.word, row.failedLetters || []);

      // Evolution calculation
      let evolutionHtml = '';
      const orig = row.originalLevel;
      const fin = row.finalLevel;

      if (orig === 'Nueva' || orig === null || orig === undefined) {
        evolutionHtml = fin > 0 ? `<span class="evolution-up">↑ Nivel ${fin}</span>` : `<span class="evolution-down">↓ Nivel 0</span>`;
      } else if (fin > orig) {
        evolutionHtml = `<span class="evolution-up">${fin} ↑</span>`;
      } else if (fin < orig) {
        evolutionHtml = `<span class="evolution-down">${fin} ↓</span>`;
      } else {
        evolutionHtml = `<span class="evolution-same">- (${fin})</span>`;
      }

      html += `
        <tr>
          <td class="word-feedback-cell">${wordHtml}</td>
          <td><span class="badge badge-1">${orig !== null && orig !== undefined ? 'N' + orig : 'Nueva'}</span></td>
          <td class="mono">${row.timeSeconds || 0}s</td>
          <td>${row.wentToRequiz ? '🔁 Re-Quiz' : '—'}</td>
          <td>${evolutionHtml}</td>
        </tr>
      `;
    });

    html += `
            </tbody>
          </table>
        </div>

        <!-- Actions Row -->
        <div class="report-actions">
          <button class="btn-secondary" onclick="ReportView.shareSummary()">📋 Compartir Resumen</button>
          <button class="btn-primary" onclick="ReportView.finishSession()">✓ Dar por Terminada la Sesión</button>
        </div>
      </div>
    `;

    container.innerHTML = html;
  }

  /**
   * Section 4.6: "Las letras donde el usuario falló se renderizan en color rojo vivo y negrita,
   * permitiendo un diagnóstico visual inmediato del error ortográfico."
   */
  static renderWordWithFailedLetters(word, failedLetters) {
    if (!word) return '';
    if (!failedLetters || failedLetters.length === 0) return word;

    const failedSet = new Set(failedLetters.map(l => l.toLowerCase()));
    let output = '';

    for (let i = 0; i < word.length; i++) {
      const char = word[i];
      if (char !== ' ' && failedSet.has(char.toLowerCase())) {
        output += `<span class="char-error-highlight">${char}</span>`;
      } else {
        output += char;
      }
    }
    return output;
  }

  static shareSummary() {
    const session = window.store.get('studySession');
    const profile = window.store.get('profile') || { displayName: 'Estudiante' };
    const results = session.sessionResults;
    const total = results.length;
    const correct = results.filter(r => r.completedSuccessfully).length;
    const pct = Math.round((correct / total) * 100);

    const summary = `📝 Lexispelling V2 - Resumen de Sesión
Alumno: ${profile.displayName}
Fecha: ${new Date().toLocaleDateString('es-ES')}
Precisión: ${pct}% (${correct}/${total})
Palabras evaluadas:
${results.map(r => `• ${r.word} (${r.completedSuccessfully ? '✓' : '✗'} ${r.timeSeconds}s)`).join('\n')}
`;

    navigator.clipboard.writeText(summary).then(() => {
      window.ModalManager.showToast('Resumen copiado al portapapeles', 'success');
    });
  }

  static finishSession() {
    window.store.set('studySession', null);
    window.app.navigate('library');
  }
}

window.ReportView = ReportView;

