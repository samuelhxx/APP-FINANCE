/**
 * charts.js — configurações Chart.js com tema dark
 */

const THEME = {
  teal:    '#00E5A0',
  danger:  '#EF4444',
  warn:    '#F59E0B',
  txt2:    '#94A3B8',
  txt3:    '#475569',
  grid:    'rgba(255,255,255,.05)',
  surface: '#1B1F26',
  bar:     '#2D3748',
};

const BASE_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 400 },
  plugins: {
    legend: {
      position: 'bottom',
      labels: { color: THEME.txt2, font: { size: 11, family: 'Inter' }, padding: 14, boxWidth: 10, boxHeight: 10 },
    },
    tooltip: {
      backgroundColor: '#0B0D10',
      borderColor: 'rgba(255,255,255,.1)',
      borderWidth: 1,
      titleColor: THEME.txt2,
      bodyColor: '#F1F5F9',
      titleFont: { size: 11, family: 'Inter' },
      bodyFont: { size: 12, family: 'Space Grotesk', weight: '700' },
      padding: 10,
    },
  },
  scales: {
    x: {
      ticks: { color: THEME.txt3, font: { size: 11 } },
      grid:  { color: THEME.grid },
      border: { color: THEME.grid },
    },
    y: {
      ticks: { color: THEME.txt3, font: { size: 10 }, callback: (v) => 'R$' + (v >= 1000 ? (v/1000).toFixed(0)+'k' : v) },
      grid:  { color: THEME.grid },
      border: { color: 'transparent' },
    },
  },
};

let instances = {};

function destroy(id) {
  if (instances[id]) { instances[id].destroy(); delete instances[id]; }
}

function destroyAll() {
  Object.keys(instances).forEach(destroy);
}

/** Gráfico de linha — evolução da reserva */
function renderReserveLine(canvasId, months, saldos) {
  destroy(canvasId);
  const ctx = document.getElementById(canvasId)?.getContext('2d');
  if (!ctx) return;

  const gradient = ctx.createLinearGradient(0, 0, 0, 200);
  gradient.addColorStop(0,   'rgba(0,229,160,.18)');
  gradient.addColorStop(1,   'rgba(0,229,160,0)');

  instances[canvasId] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: months,
      datasets: [{
        label: 'Saldo da Reserva',
        data: saldos,
        borderColor: THEME.teal,
        backgroundColor: gradient,
        fill: true,
        tension: 0.35,
        pointRadius: 4,
        pointBackgroundColor: THEME.teal,
        pointBorderColor: '#14171C',
        pointBorderWidth: 2,
      }],
    },
    options: {
      ...BASE_OPTIONS,
      plugins: {
        ...BASE_OPTIONS.plugins,
        legend: { display: false },
        tooltip: {
          ...BASE_OPTIONS.plugins.tooltip,
          callbacks: {
            label: (c) => ' ' + c.parsed.y.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
          },
        },
      },
    },
  });
}

/** Gráfico de barras — entrou vs saiu por mês */
function renderMonthBar(canvasId, months, entrou, saiu) {
  destroy(canvasId);
  const ctx = document.getElementById(canvasId)?.getContext('2d');
  if (!ctx) return;

  instances[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months,
      datasets: [
        {
          label: 'Entrou',
          data: entrou,
          backgroundColor: 'rgba(0,229,160,.5)',
          borderColor: THEME.teal,
          borderWidth: 1,
          borderRadius: 4,
        },
        {
          label: 'Saiu',
          data: saiu,
          backgroundColor: 'rgba(239,68,68,.35)',
          borderColor: THEME.danger,
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    },
    options: {
      ...BASE_OPTIONS,
      plugins: {
        ...BASE_OPTIONS.plugins,
        tooltip: {
          ...BASE_OPTIONS.plugins.tooltip,
          callbacks: {
            label: (c) => ` ${c.dataset.label}: ` + Number(c.parsed.y).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
          },
        },
      },
    },
  });
}

/** Gráfico donut — gastos por categoria */
function renderCategoryDonut(canvasId, labels, values) {
  destroy(canvasId);
  const ctx = document.getElementById(canvasId)?.getContext('2d');
  if (!ctx) return;

  const palette = [THEME.bar, THEME.txt3, '#374151', '#4B5563', '#6B7280', THEME.warn, THEME.teal];

  instances[canvasId] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: palette.slice(0, labels.length),
        borderColor: THEME.surface,
        borderWidth: 3,
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      cutout: '68%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: THEME.txt2, font: { size: 11, family: 'Inter' }, padding: 12, boxWidth: 10, boxHeight: 10 },
        },
        tooltip: {
          ...BASE_OPTIONS.plugins.tooltip,
          callbacks: {
            label: (c) => ` ${c.label}: ` + Number(c.parsed).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
          },
        },
      },
    },
  });
}

export { renderReserveLine, renderMonthBar, renderCategoryDonut, destroyAll };
