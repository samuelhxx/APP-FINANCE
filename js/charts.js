/**
 * charts.js — Chart.js dark theme wrappers
 */

const C = {
  teal:    '#00E5A0',
  danger:  '#EF4444',
  warn:    '#F59E0B',
  txt2:    '#94A3B8',
  txt3:    '#475569',
  grid:    'rgba(255,255,255,.05)',
  surf:    '#1B1F26',
  bar:     '#2D3748',
};

const TIP = {
  backgroundColor: '#0B0D10',
  borderColor: 'rgba(255,255,255,.1)',
  borderWidth: 1,
  titleColor: C.txt2,
  bodyColor: '#F1F5F9',
  titleFont: { size:11, family:'Inter' },
  bodyFont:  { size:12, family:'Space Grotesk', weight:'700' },
  padding: 10,
};

const SCALES = {
  x: {
    ticks:  { color:C.txt3, font:{size:11} },
    grid:   { color:C.grid },
    border: { color:C.grid },
  },
  y: {
    ticks:  { color:C.txt3, font:{size:10},
               callback: v => 'R$'+(Math.abs(v)>=1000?(v/1000).toFixed(0)+'k':v) },
    grid:   { color:C.grid },
    border: { color:'transparent' },
  },
};

const instances = {};

function kill(id) {
  if (instances[id]) { instances[id].destroy(); delete instances[id]; }
}

export function killAll() { Object.keys(instances).forEach(kill); }

/** Line chart — reserve evolution */
export function lineReserve(canvasId, labels, data) {
  kill(canvasId);
  const ctx = document.getElementById(canvasId)?.getContext('2d');
  if (!ctx) return;
  const grad = ctx.createLinearGradient(0,0,0,200);
  grad.addColorStop(0, 'rgba(0,229,160,.2)');
  grad.addColorStop(1, 'rgba(0,229,160,0)');
  instances[canvasId] = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{
      label: 'Reserva',
      data,
      borderColor: C.teal, backgroundColor: grad,
      fill: true, tension: 0.35,
      pointRadius: 4, pointBackgroundColor: C.teal,
      pointBorderColor: '#14171C', pointBorderWidth: 2,
    }]},
    options: {
      responsive:true, maintainAspectRatio:false, animation:{duration:400},
      plugins: {
        legend: { display:false },
        tooltip: { ...TIP, callbacks:{ label: c=>' '+Number(c.parsed.y).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) }},
      },
      scales: SCALES,
    },
  });
}

/** Bar chart — income vs spending */
export function barHistory(canvasId, labels, income, spent) {
  kill(canvasId);
  const ctx = document.getElementById(canvasId)?.getContext('2d');
  if (!ctx) return;
  instances[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [
      { label:'Comissões', data:income, backgroundColor:'rgba(0,229,160,.45)', borderColor:C.teal, borderWidth:1, borderRadius:4 },
      { label:'Gastos',   data:spent,  backgroundColor:'rgba(239,68,68,.35)',  borderColor:C.danger, borderWidth:1, borderRadius:4 },
    ]},
    options: {
      responsive:true, maintainAspectRatio:false, animation:{duration:400},
      plugins: {
        legend: { position:'bottom', labels:{ color:C.txt2, font:{size:11,family:'Inter'}, padding:14, boxWidth:10, boxHeight:10 }},
        tooltip: { ...TIP, callbacks:{ label: c=>` ${c.dataset.label}: `+Number(c.parsed.y).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) }},
      },
      scales: SCALES,
    },
  });
}

/** Line chart — debt evolution (descending) */
export function lineDebt(canvasId, labels, data) {
  kill(canvasId);
  const ctx = document.getElementById(canvasId)?.getContext('2d');
  if (!ctx) return;
  const grad = ctx.createLinearGradient(0, 0, 0, 180);
  grad.addColorStop(0, 'rgba(239,68,68,.2)');
  grad.addColorStop(1, 'rgba(239,68,68,0)');
  instances[canvasId] = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{
      label: 'Dívida total',
      data,
      borderColor: C.danger, backgroundColor: grad,
      fill: true, tension: 0.35,
      pointRadius: 4, pointBackgroundColor: C.danger,
      pointBorderColor: '#14171C', pointBorderWidth: 2,
    }]},
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 400 },
      plugins: {
        legend: { display: false },
        tooltip: { ...TIP, callbacks: { label: c => ' ' + Number(c.parsed.y).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) } },
      },
      scales: SCALES,
    },
  });
}

/** Donut — categories */
export function donutCats(canvasId, labels, values) {
  kill(canvasId);
  const ctx = document.getElementById(canvasId)?.getContext('2d');
  if (!ctx) return;
  const palette = ['#2D3748','#374151','#4B5563','#6B7280',C.warn,'#7C3AED',C.teal];
  instances[canvasId] = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{
      data: values,
      backgroundColor: palette.slice(0, labels.length),
      borderColor: C.surf, borderWidth: 3, hoverOffset: 6,
    }]},
    options: {
      responsive:true, maintainAspectRatio:false, animation:{duration:400},
      cutout: '68%',
      plugins: {
        legend: { position:'bottom', labels:{ color:C.txt2, font:{size:11,family:'Inter'}, padding:12, boxWidth:10, boxHeight:10 }},
        tooltip: { ...TIP, callbacks:{ label: c=>` ${c.label}: `+Number(c.parsed).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) }},
      },
    },
  });
}
