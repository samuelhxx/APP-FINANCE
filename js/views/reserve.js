/**
 * reserve.js — main dashboard: reserve meter + month plan + alerts
 */
import { diag as diagStore, reserve as resStore, contracts as ctStore, params as paramsStore, tx as txStore } from '../storage.js';
import { fmt, ymNow, ymLabel, reserveHealth, monthlyCost, incomeOfMonth, contractsOfMonth, planMonth, sumTx } from '../calc.js';

export function renderReserve() {
  const d  = diagStore.get();
  const r  = resStore.get();
  const p  = paramsStore.get();
  const ct = ctStore.get();
  const ym = ymNow();

  if (!d) return;

  const { total: cost } = monthlyCost(d);
  const metaVal  = cost * d.metaMonths;
  const health   = reserveHealth(r.saldo, cost, d.metaMonths);
  const monthInc = incomeOfMonth(ct, p, ym);
  const monthTxs = txStore.get(ym);
  const monthOut = sumTx(monthTxs);
  const hasInc   = monthInc > 0;

  // ── Meter ────────────────────────────────────────────────
  document.getElementById('meter').innerHTML = `
    <div class="meter-lbl">Reserva cobre</div>
    <div class="meter-val ${health.status}">
      ${health.months.toFixed(1)}
      <span style="font-size:1rem;font-weight:500;color:var(--txt2)"> meses</span>
    </div>
    <div class="meter-sub">
      ${fmt(r.saldo)} guardados · meta ${d.metaMonths} meses (${fmt(metaVal)})
    </div>
    <div class="meter-track">
      <div class="meter-fill ${health.status}" style="width:${health.pct.toFixed(1)}%"></div>
    </div>
    <div class="meter-row">
      <span>${ymLabel(ym, { month:'long', year:'numeric' })}</span>
      <span>${health.pct.toFixed(0)}% da meta</span>
    </div>`;

  // ── Alert banner ─────────────────────────────────────────
  const alertEl = document.getElementById('reserve-alert');
  if (!hasInc) {
    alertEl.innerHTML = `<div class="alert al-danger">
      ${SVG.alert}
      <div class="alert-body">
        <strong>Nenhuma comissão prevista este mês.</strong><br>
        Suas contas (${fmt(cost)}) serão cobertas pela reserva.
        ${r.saldo < cost ? '<br><strong>Atenção: reserva abaixo do custo mensal.</strong>' : ''}
      </div>
    </div>`;
    alertEl.hidden = false;
  } else if (health.status !== 'healthy') {
    alertEl.innerHTML = `<div class="alert al-warn">
      ${SVG.warn}
      <div class="alert-body">
        <strong>Mês com renda: priorize encher a reserva.</strong><br>
        Reserve o máximo antes de gastos livres ou objetivos.
      </div>
    </div>`;
    alertEl.hidden = false;
  } else {
    alertEl.hidden = true;
  }

  // ── Stats ────────────────────────────────────────────────
  set('stat-in',  fmt(monthInc), monthInc > 0 ? 'pos' : '');
  set('stat-out', fmt(monthOut), monthOut > 0 ? 'neg' : '');
  const bal = monthInc - monthOut;
  set('stat-bal', fmt(bal), bal >= 0 ? 'pos' : 'neg');

  // contracts count
  const closedCount = ct.filter(c => c.status === 'closed').length;
  const el = document.getElementById('stat-ct');
  if (el) el.textContent = closedCount || '—';

  // ── Plan suggestion (only when there's income) ────────────
  const planEl = document.getElementById('plan-block');
  if (hasInc) {
    const plan = planMonth(monthInc, cost, r.saldo, metaVal);
    const rows = [
      { label:'Fixas + dívidas',      val: cost,          color:'var(--txt2)' },
      { label:'Para a reserva',       val: plan.toReserve, color:'var(--teal)' },
      { label:'Objetivos',            val: plan.toGoals,   color:'var(--warn)' },
      { label:'Livre / outros',       val: plan.toFree,    color:'var(--txt2)' },
    ].filter(r => r.val > 0);

    const deficitHtml = plan.deficit > 0
      ? `<div class="alert al-danger" style="margin-top:12px">${SVG.alert}
           <div class="alert-body"><strong>Comissão menor que o custo do mês.</strong><br>
           Faltam ${fmt(plan.deficit)} — sairá da reserva.</div></div>` : '';

    planEl.innerHTML = `
      <div class="sh">Sugestão de distribuição</div>
      <div class="card card-p" style="margin:0 16px">
        ${rows.map(r=>`
          <div style="display:flex;justify-content:space-between;align-items:center;
                      padding:9px 0;border-bottom:1px solid var(--border)">
            <span style="font-size:.85rem;color:var(--txt2)">${r.label}</span>
            <span class="num fw7" style="color:${r.color}">${fmt(r.val)}</span>
          </div>`).join('')}
      </div>
      ${deficitHtml}
      <div class="disclaimer" style="margin-top:12px">
        ${SVG.info}
        Estimativa com base nos seus dados. Não substitui orientação de um profissional financeiro.
      </div>`;
    planEl.hidden = false;
  } else {
    planEl.hidden = true;
  }

  // ── Realism check ────────────────────────────────────────
  const rcEl = document.getElementById('realism-check');
  if (health.months < 2 && monthOut > cost * 0.3) {
    rcEl.innerHTML = `<div class="alert al-warn" style="margin:0 16px 12px">
      ${SVG.warn}
      <div class="alert-body"><strong>Reserva baixa e gastos acima do necessário.</strong><br>
      Priorize encher a reserva antes de gastos livres.</div>
    </div>`;
    rcEl.hidden = false;
  } else {
    rcEl.hidden = true;
  }
}

// ── Helpers ───────────────────────────────────────────────────
function set(id, text, cls = '') {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className = `stat-val num ${cls}`.trim();
}

const SVG = {
  alert: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  warn:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  info:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
};
