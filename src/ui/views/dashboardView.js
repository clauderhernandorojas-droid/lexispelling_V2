// ============================================================================
// Lexispelling V2 - Dashboard & Metrics View
// Active study time, 7-day goal cutoff chart, SRS distribution, discipline scorecard
// ============================================================================

class DashboardView {
  static async render() {
    const container = document.getElementById('view-dashboard');
    if (!container) return;

    const profile = await window.api.getProfile() || { dailyHoursGoal: 0.5 };
    const todayStats = await window.api.getDailyStats() || { studyMinutes: 0, evaluationMinutes: 0 };
    const past7Days = await window.api.getPast7DaysStats() || [];
    const metrics = await window.api.getOverallMetrics() || {
      wordsToEvaluateToday: 0,
      distribution: { new: 0, level0: 0, level1: 0, level2: 0, level3: 0, level4: 0 },
      delayedCount: 0,
      delayedDaysTotal: 0,
      monthlyLearnedCount: 0
    };

    const dailyGoalMinutes = (profile.dailyHoursGoal || 0.5) * 60;
    const totalTodayMinutes = Number((todayStats.studyMinutes + todayStats.evaluationMinutes).toFixed(1));
    const goalPct = Math.min(100, Math.round((totalTodayMinutes / dailyGoalMinutes) * 100));
    const overtimeMinutes = Math.max(0, Number((totalTodayMinutes - dailyGoalMinutes).toFixed(1)));

    // Find max for 7-day chart scaling
    const maxDayMinutes = Math.max(dailyGoalMinutes * 1.3, ...past7Days.map(d => d.totalMinutes), 30);
    const goalLineBottomPct = Math.round((dailyGoalMinutes / maxDayMinutes) * 100);

    let nextExamText = 'Ninguno programado';
    if (metrics.nextScheduledExamDate) {
      const d = new Date(metrics.nextScheduledExamDate);
      nextExamText = `${d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} (${metrics.nextScheduledExamVolume} palabras)`;
    }

    let html = `
      <div class="dashboard-container">
        <!-- Top Title Bar -->
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 28px;">
          <div>
            <h2 style="font-size: 24px; font-weight: 800; color: #fff;">Dashboard de Métricas & Disciplina</h2>
            <p style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">Seguimiento en tiempo real de tu curva de retención y tiempo activo de concentración.</p>
          </div>
          <button class="btn-secondary" onclick="window.app.navigate('library')">← Volver a Biblioteca</button>
        </div>

        <!-- Section 1: KPI Cards -->
        <div class="report-stats-grid" style="margin-bottom: 24px;">
          <div class="report-stat-card">
            <span class="stat-card-label">Palabras para Hoy</span>
            <span class="stat-card-value" style="color: var(--accent-cyan);">${metrics.wordsToEvaluateToday}</span>
            <span class="stat-card-sub">Nuevas + Vencidas</span>
          </div>

          <div class="report-stat-card">
            <span class="stat-card-label">Tiempo Activo Hoy</span>
            <span class="stat-card-value mono">${totalTodayMinutes} min</span>
            <span class="stat-card-sub">${todayStats.studyMinutes}m Flashcards • ${todayStats.evaluationMinutes}m Quiz</span>
          </div>

          <div class="report-stat-card">
            <span class="stat-card-label">Meta Diaria (${profile.dailyHoursGoal || 0.5}h)</span>
            <span class="stat-card-value" style="color: ${goalPct >= 100 ? 'var(--success)' : 'var(--warning)'};">${goalPct}%</span>
            <span class="stat-card-sub">${overtimeMinutes > 0 ? `+${overtimeMinutes}m extra trabajado` : `Faltan ${(dailyGoalMinutes - totalTodayMinutes).toFixed(1)}m`}</span>
          </div>

          <div class="report-stat-card">
            <span class="stat-card-label">Dominadas este Mes</span>
            <span class="stat-card-value" style="color: var(--purple);">${metrics.monthlyLearnedCount}</span>
            <span class="stat-card-sub">Alcanzaron Nivel 4</span>
          </div>
        </div>

        <!-- Section 2: 7-Day Chart & Discipline Scorecard Grid -->
        <div class="dashboard-grid-2">
          <!-- 7-Day Bar Chart with Goal Cutoff Line -->
          <div class="dashboard-card">
            <div class="card-title-row">
              <span class="card-heading">Actividad de los Últimos 7 Días</span>
              <span style="font-size: 11px; color: var(--warning); font-weight: 600;">Línea discontinua: Meta</span>
            </div>

            <div class="chart-container">
              <!-- Threshold Goal Line -->
              <div class="chart-goal-line" style="bottom: ${goalLineBottomPct}%;">
                <span class="goal-line-label">Meta (${dailyGoalMinutes} min)</span>
              </div>

              <!-- Day Bars -->
              ${past7Days.map(d => {
                const heightPct = Math.min(100, Math.max(6, Math.round((d.totalMinutes / maxDayMinutes) * 100)));
                const isExceeded = d.totalMinutes >= dailyGoalMinutes;
                return `
                  <div class="chart-bar-col">
                    <span style="font-size: 10px; color: var(--text-dim);">${d.totalMinutes > 0 ? d.totalMinutes + 'm' : ''}</span>
                    <div class="chart-bar-fill ${isExceeded ? 'exceeded' : ''}" style="height: ${heightPct}%;" title="${d.date}: ${d.totalMinutes} min"></div>
                    <span class="chart-day-label">${d.dayName}</span>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Discipline & Delays Scorecard -->
          <div class="dashboard-card">
            <div class="card-title-row">
              <span class="card-heading">Disciplina y Retrasos SRS</span>
              <span style="font-size: 11px; color: var(--text-dim);">Detección de desvíos</span>
            </div>

            <div class="discipline-metrics-list">
              <div class="discipline-item ${metrics.delayedCount > 0 ? 'alert' : ''}">
                <div>
                  <div style="font-size: 14px; font-weight: 700; color: #fff;">Palabras Retrasadas (Overdue)</div>
                  <div style="font-size: 12px; color: var(--text-muted);">Pendientes de días anteriores sin repasar</div>
                </div>
                <div style="font-size: 20px; font-weight: 800; color: ${metrics.delayedCount > 0 ? 'var(--error)' : 'var(--success)'};">
                  ${metrics.delayedCount}
                </div>
              </div>

              <div class="discipline-item ${metrics.delayedDaysTotal > 0 ? 'alert' : ''}">
                <div>
                  <div style="font-size: 14px; font-weight: 700; color: #fff;">Días de Retraso Acumulados</div>
                  <div style="font-size: 12px; color: var(--text-muted);">Suma total de desfase temporal en el SRS</div>
                </div>
                <div style="font-size: 20px; font-weight: 800; color: ${metrics.delayedDaysTotal > 0 ? 'var(--error)' : 'var(--success)'};">
                  ${metrics.delayedDaysTotal} d
                </div>
              </div>

              <div class="discipline-item">
                <div>
                  <div style="font-size: 14px; font-weight: 700; color: #fff;">Próximo Examen Programado</div>
                  <div style="font-size: 12px; color: var(--text-muted);">Siguiente pico de repaso futuro</div>
                </div>
                <div style="font-size: 15px; font-weight: 700; color: var(--accent-cyan);">
                  ${nextExamText}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Section 3: SRS Distribution Table -->
        <div class="dashboard-card">
          <div class="card-title-row">
            <span class="card-heading">Distribución del Inventario por Niveles SRS</span>
            <span style="font-size: 12px; color: var(--text-muted);">Intervalos de consolidación en memoria</span>
          </div>

          <table class="srs-dist-table">
            <thead>
              <tr>
                <th>Nivel</th>
                <th>Intervalo Fijo</th>
                <th>Vidas en Quiz</th>
                <th>Palabras en este Nivel</th>
                <th>Estado Cognitivo</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><span class="badge badge-new">Nueva</span></td>
                <td>Inmediato (Flashcards)</td>
                <td>3 Vidas</td>
                <td style="font-weight: 700; color: #fff;">${metrics.distribution.new}</td>
                <td style="color: var(--text-muted);">Sin evaluar ortográficamente</td>
              </tr>
              <tr>
                <td><span class="badge badge-0">Nivel 0</span></td>
                <td>+1 Día</td>
                <td>3 Vidas</td>
                <td style="font-weight: 700; color: #fff;">${metrics.distribution.level0}</td>
                <td style="color: var(--error);">Penalizada por fallos</td>
              </tr>
              <tr>
                <td><span class="badge badge-1">Nivel 1</span></td>
                <td>+2 Días</td>
                <td>3 Vidas</td>
                <td style="font-weight: 700; color: #fff;">${metrics.distribution.level1}</td>
                <td style="color: var(--warning);">Retención inicial reciente</td>
              </tr>
              <tr>
                <td><span class="badge badge-2">Nivel 2</span></td>
                <td>+5 Días</td>
                <td>2 Vidas</td>
                <td style="font-weight: 700; color: #fff;">${metrics.distribution.level2}</td>
                <td style="color: var(--success);">Afianzamiento de memoria</td>
              </tr>
              <tr>
                <td><span class="badge badge-3">Nivel 3</span></td>
                <td>+15 Días</td>
                <td>1 Vida</td>
                <td style="font-weight: 700; color: #fff;">${metrics.distribution.level3}</td>
                <td style="color: var(--accent-cyan);">Retención intermedia consolidada</td>
              </tr>
              <tr>
                <td><span class="badge badge-4">Nivel 4</span></td>
                <td>+30 Días</td>
                <td>0 Vidas (Maestría)</td>
                <td style="font-weight: 700; color: #fff;">${metrics.distribution.level4}</td>
                <td style="color: var(--purple);">Dominada / Circuito de Mantenimiento</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    container.innerHTML = html;
  }
}

window.DashboardView = DashboardView;

