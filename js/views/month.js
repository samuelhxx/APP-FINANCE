/**
 * month.js — monthly view: planejado vs realizado + lançamentos + gráficos
 */
import {
  tx as txStore, contracts as ctStore, params as paramsStore,
  reserve as resStore, diag as diagStore,
  debtState as debtStateStore, snapshots,
} from '../storage.js';
import {
  fmt, ymNow, ymLabel, incomeOfMonth, sumTx, byCategory,
  generatePlan, currentDebtTotal,
} from '../calc.js';
import { CAT_ICON, CATS } from './launch.js';
import { lineReserve, barHistory, donutCats, lineDebt } from '../charts.js';

let activeYM   = ymNow();
let _onChanged = null;

export function initMonth(onChanged) {
  _onChanged = onChanged;
}

export function renderMonth() {
  activeYM = ymNow();
  buildPills();
  renderData();
}

function buildPills() {
  const wrap = document.getElementById('month-pills');
  if (!wrap) return;
  wrap.innerHTML = '';
  for (let i = 5; i >= 0; i--) {
    const d   = new Date();
    d.setMonth(d.getMonth() - i);
    const ym  = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const b   = document.createElement('button');
    b.className   = 'month-pill' + (ym === activeYM ? ' active' : '');
    b.textContent = d.toLocaleDateString('pt-BR',{month:'short',year:'2-digit'}).replace('.','');
    b.dataset.ym  = ym;
    b.addEventListener('click', () => { activeYM = ym; buildPills(); renderData(); });
    wrap.appendChild(b);
  }
}

function renderData() {
  const txs    = txStore.get(activeYM);
  const p      = paramsStore.get();
  const ct     = ctStore.get();
  const d      = diagStore.get();
  const r      = resStore.get();
  const snap   = snapshots.get(activeYM);
  const now    = ymNow();
  const isNow  = activeYM === now;

  const inc  = snap ? snap.income  : incomeOfMonth(ct, p, activeYM);
  const out  = snap ? snap.spent   : sumTx(txs);
  const bal  = inc - out;

  // ── Stats ────────────────────────────────────────────────
  const setEl = (id, text, cls='') => {
    const e = document.getElementById(id);
    if (e) { e.textContent = text; e.className = `stat-val num ${cls}`.trim(); }
  };
  setEl('m-income', fmt(inc), inc > 0 ? 'pos' : '');
  setEl('m-out',    fmt(out), out > 0 ? 'neg' : '');
  setEl('m-bal',    fmt(bal), bal >= 0 ? 'pos' : 'neg');

  // ── Planejado vs Realizado ───────────────────────────────
  renderPlanVsReal(txs, inc, d, r, snap, isNow);

  // ── Fechar mês ───────────────────────────────────────────
  renderCloseButton(isNow, snap, d, inc, out, txs);

  // ── Tx list ──────────────────────────────────────────────
  renderTxList(snap ? [] : txs, snap);

  // ── Charts ───────────────────────────────────────────────
  renderCharts(txs, ct, p, d);
}

// ── Planejado vs Realizado ────────────────────────────────────
function renderPlanVsReal(txs, income, d, r, snap, isNow) {
  const el = document.getElementById('month-plan-cmp');
  if (!el) return;
  if (!d) { el.innerHTML = ''; return; }

  const dsMap = debtStateStore.init(d.debts || []);
  const plan  = generatePlan(d, dsMap, income, r.saldo);
  const catMap = byCategory(txs);

  // Realizado na reserva = lançamentos cat='reserva'
  const realReserva = catMap['reserva'] || 0;
  // Realizado em dívidas = cat='divida'
  const realDivida  = catMap['divida']  || 0;
  // Total gasto (exceto reserva — reserva é destino, não gasto)
  const realGasto   = Object.entries(catMap)
    .filter(([k]) => k !== 'reserva')
    .reduce((s, [, v]) => s + v, 0);

  const planTotalDivida = plan.toDebtMin + plan.toDebtExtra;
  const planReserva     = plan.toReserveTotal;

  const rows = [
    {
      label:   'Renda recebida',
      planned: income,
      real:    income,
      color:   'var(--teal)',
      nobar:   true,
    },
    {
      label:   'Fixas + parcelas',
      planned: plan.toFixas + plan.toDebtMin,
      real:    realGasto,
      color:   'var(--txt2)',
    },
    ...(planTotalDivida > plan.toDebtMin || realDivida > 0 ? [{
      label:   'Aceleração de dívida',
      planned: plan.toDebtExtra,
      real:    realDivida,
      color:   'var(--warn)',
    }] : []),
    {
      label:   'Aporte na reserva',
      planned: planReserva,
      real:    realReserva,
      color:   'var(--teal)',
    },
  ];

  const title = snap
    ? `Mês fechado · ${ymLabel(activeYM, { month: 'long', year: 'numeric' })}`
    : isNow
      ? 'Planejado vs. Realizado'
      : ymLabel(activeYM, { month: 'long', year: 'numeric' });

  el.innerHTML = `
    <div class="sh">${title}</div>
    <div class="plan-cmp-card">
      <div class="plan-cmp-head">
        <span></span>
        <span class="plan-cmp-col-lbl">Planejado</span>
        <span class="plan-cmp-col-lbl">Realizado</span>
      </div>
      ${rows.map(row => {
        const pct  = row.planned > 0 ? Math.min(row.real / row.planned * 100, 100) : 0;
        const ok   = row.real >= row.planned * 0.9;
        const over = row.real > row.planned * 1.1;
        const status = over ? 'neg' : ok ? 'pos' : '';
        return `
        <div class="plan-cmp-row">
          <span class="plan-cmp-lbl">${row.label}</span>
          <span class="plan-cmp-val num">${fmt(row.planned)}</span>
          <span class="plan-cmp-val num ${status}">${fmt(row.real)}</span>
          ${!row.nobar ? `
          <div class="plan-cmp-bar-wrap">
            <div class="plan-cmp-bar" style="width:${pct.toFixed(1)}%;background:${row.color}"></div>
          </div>` : `<div></div>`}
        </div>`;
      }).join('')}
    </div>`;
}

// ── Botão fechar mês ──────────────────────────────────────────
function renderCloseButton(isNow, snap, d, income, spent, txs) {
  const el = document.getElementById('month-close-wrap');
  if (!el) return;

  if (!isNow || snap) {
    el.innerHTML = snap
      ? `<div class="month-closed-badge">
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
           Mês fechado em ${new Date(snap.closedAt).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})}
         </div>`
      : '';
    return;
  }

  el.innerHTML = `
    <div style="padding:0 16px 4px">
      <button id="btn-close-month" class="btn btn-ghost" style="width:100%;border-color:var(--teal);color:var(--teal)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        Fechar mês
      </button>
      <div style="font-size:.72rem;color:var(--txt3);text-align:center;margin-top:6px">
        Salva o resumo e reduz automaticamente o saldo das dívidas pelas parcelas mínimas.
      </div>
    </div>`;

  document.getElementById('btn-close-month')?.addEventListener('click', () => {
    closeMonth(activeYM, income, spent, txs, d);
  });
}

function closeMonth(ym, income, spent, txs, d) {
  if (!confirm('Fechar o mês? Os saldos das dívidas serão reduzidos pelas parcelas mínimas.')) return;

  const r      = resStore.get();
  const dsMap  = debtStateStore.init(d?.debts || []);
  const catMap = byCategory(txs);

  snapshots.set(ym, {
    income,
    spent,
    spentByCategory: catMap,
    reserveEnd:  r.saldo,
    debtState:   { ...dsMap },
    closedAt:    new Date().toISOString(),
  });

  // Reduz saldos de dívidas pelas parcelas mínimas
  if (d?.debts?.length) {
    debtStateStore.payInstallments(d.debts);
  }

  renderData();
  _onChanged?.();
}

// ── Tx list ───────────────────────────────────────────────────
function renderTxList(txs, snap) {
  const el = document.getElementById('month-txs');
  if (!el) return;

  if (snap) {
    // Mês fechado — mostra resumo do snapshot
    const cats = Object.entries(snap.spentByCategory || {})
      .sort((a, b) => b[1] - a[1]);
    if (!cats.length) {
      el.innerHTML = `<div class="empty" style="padding:24px 20px">
        <div class="empty-title">Sem lançamentos registrados</div></div>`;
      return;
    }
    el.innerHTML = cats.map(([cat, val]) => {
      const ico = CAT_ICON[cat] || CAT_ICON.outros;
      const lbl = CATS.find(c => c.id === cat)?.label || cat;
      return `<div class="tx-item">
        <div class="tx-ico">${ico}</div>
        <div class="tx-body"><div class="tx-desc">${lbl}</div></div>
        <div class="tx-amt">− ${fmt(val)}</div>
      </div>`;
    }).join('');
    return;
  }

  if (!txs.length) {
    el.innerHTML = `<div class="empty" style="padding:32px 20px">
      <div class="empty-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg></div>
      <div class="empty-title">Nenhum lançamento</div>
      <div class="empty-sub">Use o botão Lançar para registrar gastos.</div>
    </div>`; return;
  }

  const sorted = [...txs].sort((a,b) => b.date.localeCompare(a.date));
  el.innerHTML = sorted.map(t => {
    const dd  = new Date(t.date+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short'});
    const ico = CAT_ICON[t.cat] || CAT_ICON.outros;
    const lbl = CATS.find(c => c.id === t.cat)?.label || t.cat;
    return `<div class="tx-item">
      <div class="tx-ico">${ico}</div>
      <div class="tx-body">
        <div class="tx-desc">${esc(t.desc)}</div>
        <div class="tx-meta">${dd} · ${lbl}</div>
      </div>
      <div class="tx-amt">− ${fmt(t.value)}</div>
      <button class="tx-del" data-id="${t.id}" data-ym="${t.date.slice(0,7)}" title="Remover">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
      </button>
    </div>`;
  }).join('');

  el.querySelectorAll('.tx-del').forEach(b => b.addEventListener('click', () => {
    txStore.remove(b.dataset.id, b.dataset.ym);
    renderData(); _onChanged?.();
  }));
}

// ── Charts ────────────────────────────────────────────────────
function renderCharts(txs, ct, p, d) {
  // Donut gastos por categoria
  const catMap  = byCategory(txs);
  const catWrap = document.getElementById('month-donut-wrap');
  if (!catMap || Object.keys(catMap).length === 0) {
    if (catWrap) catWrap.innerHTML = `<div class="empty" style="padding:24px">
      <div class="empty-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg></div>
      <div class="empty-sub">Sem gastos para exibir</div></div>`;
  } else {
    const sorted = Object.entries(catMap).sort((a,b)=>b[1]-a[1]).slice(0,6);
    if (catWrap) catWrap.innerHTML = `<canvas id="chart-donut"></canvas>`;
    donutCats('chart-donut', sorted.map(([k]) => CATS.find(c=>c.id===k)?.label||k), sorted.map(([,v])=>v));
  }

  // Gerar série histórica dos 6 meses
  const months=[], income=[], spent=[], saldos=[], debtTotals=[];
  const reserve   = resStore.get();
  const histMap   = {};
  (reserve.log||[]).forEach(h => { histMap[h.ym] = (histMap[h.ym]||0)+h.delta; });

  const yms = [];
  for (let i = 5; i >= 0; i--) {
    const dd = new Date(); dd.setMonth(dd.getMonth()-i);
    yms.push(`${dd.getFullYear()}-${String(dd.getMonth()+1).padStart(2,'0')}`);
  }

  // Reconstruir saldo da reserva retrospectivamente
  let running = reserve.saldo;
  const saldoArr = new Array(6);
  for (let i = 5; i >= 0; i--) { saldoArr[i] = running; running -= (histMap[yms[i]]||0); }

  // Reconstruir dívida total histórica a partir dos snapshots
  const allSnaps = snapshots.getAll();

  for (let i = 0; i < 6; i++) {
    const dd = new Date(); dd.setMonth(dd.getMonth()-(5-i));
    months.push(dd.toLocaleDateString('pt-BR',{month:'short'}).replace('.',''));
    income.push(incomeOfMonth(ct, p, yms[i]));
    spent.push(sumTx(txStore.get(yms[i])));
    saldos.push(saldoArr[i]);

    // Dívida total no snapshot, ou estimativa atual para meses sem snapshot
    const snap = allSnaps.find(s => s.ym === yms[i]);
    if (snap?.debtState && d?.debts) {
      debtTotals.push(currentDebtTotal(d.debts, snap.debtState));
    } else if (i === 5 && d?.debts) {
      debtTotals.push(currentDebtTotal(d.debts, debtStateStore.init(d.debts)));
    } else {
      debtTotals.push(null);
    }
  }

  barHistory('chart-bar-hist', months, income, spent);
  lineReserve('chart-line-res', months, saldos);

  // Gráfico de evolução da dívida (só exibe se há dados)
  const debtWrap = document.getElementById('month-debt-wrap');
  const hasDebtData = debtTotals.some(v => v !== null && v > 0);
  if (debtWrap) {
    if (hasDebtData) {
      debtWrap.innerHTML = `<canvas id="chart-line-debt"></canvas>`;
      lineDebt('chart-line-debt', months, debtTotals);
    } else {
      debtWrap.innerHTML = `<div class="empty" style="padding:24px">
        <div class="empty-sub">Sem dívidas registradas</div></div>`;
    }
  }
}

function esc(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
