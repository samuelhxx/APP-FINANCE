/**
 * reserve.js — main dashboard: reserva + plano financeiro completo
 */
import {
  diag as diagStore, reserve as resStore,
  contracts as ctStore, params as paramsStore,
  tx as txStore, debtState as debtStateStore,
} from '../storage.js';
import {
  fmt, ymNow, ymLabel, reserveHealth, monthlyCost,
  incomeOfMonth, generatePlan, currentDebtTotal,
} from '../calc.js';

export function renderReserve() {
  const d  = diagStore.get();
  const r  = resStore.get();
  const p  = paramsStore.get();
  const ct = ctStore.get();
  const ym = ymNow();

  if (!d) return;

  // Inicializa saldos de dívidas na primeira vez
  const dsMap  = debtStateStore.init(d.debts || []);
  const debts  = d.debts || [];

  const { total: cost, fixas: costFixas, debts: costDebts } = monthlyCost(d);
  const metaVal   = cost * d.metaMonths;
  const health    = reserveHealth(r.saldo, cost, d.metaMonths);
  const monthInc  = incomeOfMonth(ct, p, ym);
  const monthTxs  = txStore.get(ym);
  const monthOut  = monthTxs.reduce((s, t) => s + Number(t.value), 0);

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

  // ── Alert ────────────────────────────────────────────────
  const alertEl = document.getElementById('reserve-alert');
  if (!monthInc) {
    alertEl.innerHTML = `<div class="alert al-danger">
      ${SVG.alert}
      <div class="alert-body">
        <strong>Nenhuma comissão prevista este mês.</strong><br>
        Seus custos (${fmt(cost)}) serão cobertos pela reserva.
        ${r.saldo < cost ? '<br><strong>Atenção: reserva abaixo de 1 mês de custo.</strong>' : ''}
      </div>
    </div>`;
    alertEl.hidden = false;
  } else if (health.status !== 'healthy') {
    alertEl.innerHTML = `<div class="alert al-warn">
      ${SVG.warn}
      <div class="alert-body">
        <strong>Renda recebida este mês — priorize a reserva.</strong><br>
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
  const closedCount = ct.filter(c => c.status === 'closed').length;
  const elCt = document.getElementById('stat-ct');
  if (elCt) elCt.textContent = closedCount || '—';

  // ── Plano financeiro ──────────────────────────────────────
  const planEl = document.getElementById('plan-block');
  const plan   = generatePlan(d, dsMap, monthInc, r.saldo);
  planEl.innerHTML = renderPlan(plan, debts, dsMap, cost);
  planEl.hidden = false;

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

// ── Renderiza o plano detalhado ───────────────────────────────
function renderPlan(plan, debts, dsMap, monthlyCostTotal) {
  const hasIncome = plan.income > 0;
  const totalDebt = currentDebtTotal(debts, dsMap);
  const hasDebts  = totalDebt > 0;

  // Cabeçalho da seção
  let html = `<div class="sh">Plano do mês</div>
  <div class="plan-card">`;

  if (!hasIncome) {
    // ── Sem renda este mês ───────────────────────────────
    html += `
    <div class="plan-no-income">
      <div class="plan-no-income-ico">${SVG.alert}</div>
      <div>
        <div style="font-size:.88rem;font-weight:600;color:var(--danger)">Mês sem comissão</div>
        <div style="font-size:.8rem;color:var(--txt2);margin-top:3px">
          A reserva cobre os custos deste mês. Registre um recebimento nos Contratos quando chegar uma comissão.
        </div>
      </div>
    </div>
    <div style="border-top:1px solid var(--border);margin:12px 0"></div>
    <div class="plan-step">
      <span class="plan-step-lbl">Custo do mês (reserva cobre)</span>
      <span class="plan-step-val neg">${fmt(monthlyCostTotal)}</span>
    </div>`;
  } else {
    // ── Com renda — cascata completa ─────────────────────

    // Déficit?
    if (plan.deficit > 0) {
      html += `<div class="alert al-danger" style="margin-bottom:12px">
        ${SVG.alert}
        <div class="alert-body"><strong>Comissão menor que os custos do mês.</strong><br>
        Faltam ${fmt(plan.deficit)} — a reserva cobrirá a diferença.</div>
      </div>`;
    }

    // Passo 1 — Fixas
    if (plan.toFixas > 0) {
      html += planStep(
        '1', 'Contas fixas',
        `${plan.fixasList.length} conta${plan.fixasList.length !== 1 ? 's' : ''}`,
        plan.toFixas, 'var(--txt2)', false,
      );
    }

    // Passo 2 — Parcelas mínimas
    if (plan.toDebtMin > 0) {
      const names = plan.debtMinList.map(d => d.name).join(', ');
      html += planStep(
        '2', 'Parcelas mínimas de dívidas',
        names || 'dívidas ativas',
        plan.toDebtMin, 'var(--warn)', false,
      );
    }

    // Passo 3 — Reserva urgente
    if (plan.toReserveUrgent > 0) {
      html += planStep(
        '3', 'Reserva — urgente',
        'Trazer reserva para cobrir ao menos 1 mês',
        plan.toReserveUrgent, 'var(--danger)', true,
      );
    }

    // Passo 4 — Aceleração Snowball
    if (plan.toDebtExtra > 0 && plan.targetDebt) {
      html += planStep(
        '4', `Foco na dívida: ${plan.targetDebt.name}`,
        `Snowball — menor saldo primeiro · ${fmt(plan.targetDebt.currentBalance)} restando`,
        plan.toDebtExtra, 'var(--warn)', false,
      );
    }

    // Passo 5 — Reserva completa
    if (plan.toReserveFull > 0) {
      html += planStep(
        '5', 'Reserva — completar meta',
        `Faltam ${fmt(Math.max(0, plan.metaFull - plan.reserveSaldo))} para ${plan.debtMinList.length ? '' : ''}a meta de ${plan.meta1 > 0 ? Math.round(plan.metaFull / plan.meta1) : '—'} meses`,
        plan.toReserveFull, 'var(--teal)', false,
      );
    }

    // Passo 6 — Livre / Objetivos
    if (plan.toGoals > 0 || plan.toFree > 0) {
      html += planStep(
        '6', plan.reserveComplete ? 'Objetivos + livre' : 'Livre (reserva incompleta)',
        plan.reserveComplete ? '50% objetivos · 50% gastos livres' : 'Priorize a reserva antes de objetivos',
        (plan.toGoals + plan.toFree), plan.reserveComplete ? 'var(--teal)' : 'var(--txt3)', false,
      );
    }
  }

  html += `</div>`;

  // ── Projeções ─────────────────────────────────────────────
  const projRows = [];

  if (hasDebts && debts.length > 0) {
    const dm = plan.projDebtMonths;
    projRows.push({
      label: 'Dívidas zeradas em',
      value: dm === 0 ? 'Já quitado' : dm === null ? '> 30 anos' : `~${dm} ${dm === 1 ? 'mês' : 'meses'}`,
      color: dm === 0 ? 'var(--teal)' : dm && dm <= 12 ? 'var(--teal)' : 'var(--warn)',
    });
  }

  if (plan.reserveSaldo < plan.metaFull) {
    const rm = plan.projReserveMonths;
    projRows.push({
      label: 'Reserva completa em',
      value: rm === null ? 'Sem aporte previsto' : rm === 0 ? 'Meta atingida' : `~${rm} ${rm === 1 ? 'mês' : 'meses'}`,
      color: rm === null ? 'var(--txt3)' : rm <= 6 ? 'var(--teal)' : 'var(--warn)',
    });
  } else {
    projRows.push({ label: 'Reserva', value: 'Meta atingida', color: 'var(--teal)' });
  }

  if (projRows.length) {
    html += `<div class="sh" style="margin-top:4px">Projeção</div>
    <div class="plan-proj-row">
      ${projRows.map(r => `
        <div class="plan-proj-item">
          <div class="plan-proj-lbl">${r.label}</div>
          <div class="plan-proj-val" style="color:${r.color}">${r.value}</div>
        </div>`).join('')}
    </div>`;
  }

  // Total de dívidas atual
  if (hasDebts) {
    html += `<div style="margin:0 16px 16px">
      <div style="display:flex;justify-content:space-between;align-items:center;
                  background:var(--bg-raise);border-radius:var(--r-sm);padding:10px 12px">
        <span style="font-size:.8rem;color:var(--txt2)">Dívida total atual</span>
        <span class="num fw7" style="color:var(--warn);font-size:.95rem">${fmt(totalDebt)}</span>
      </div>
    </div>`;
  }

  html += `<div class="disclaimer" style="margin:0 16px 8px">
    ${SVG.info} Plano estimado com base nos seus dados. Não substitui orientação de um profissional financeiro.
  </div>`;

  return html;
}

function planStep(num, title, sub, value, color, urgent) {
  return `
  <div class="plan-step${urgent ? ' plan-step-urgent' : ''}">
    <div class="plan-step-num">${num}</div>
    <div class="plan-step-body">
      <div class="plan-step-title">${title}</div>
      ${sub ? `<div class="plan-step-sub">${sub}</div>` : ''}
    </div>
    <div class="plan-step-val" style="color:${color}">${fmt(value)}</div>
  </div>`;
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
