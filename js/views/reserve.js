/**
 * reserve.js — dashboard: reserva + plano financeiro detalhado com frases e barra segmentada
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

  const dsMap  = debtStateStore.init(d.debts || []);
  const { total: cost } = monthlyCost(d);
  const metaVal  = cost * d.metaMonths;
  const health   = reserveHealth(r.saldo, cost, d.metaMonths);
  const monthInc = incomeOfMonth(ct, p, ym);
  const monthOut = txStore.get(ym).reduce((s, t) => s + Number(t.value), 0);

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
        <strong>Nenhuma comissão registrada este mês.</strong><br>
        Custos (${fmt(cost)}) serão cobertos pela reserva.
        ${r.saldo < cost ? '<br><strong>Atenção: reserva abaixo de 1 mês de custo.</strong>' : ''}
      </div>
    </div>`;
    alertEl.hidden = false;
  } else if (health.status !== 'healthy') {
    alertEl.innerHTML = `<div class="alert al-warn">
      ${SVG.warn}
      <div class="alert-body">
        <strong>Renda registrada — priorize encher a reserva.</strong><br>
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
  const elCt = document.getElementById('stat-ct');
  if (elCt) elCt.textContent = ct.filter(c => c.status === 'closed').length || '—';

  // ── Plano ────────────────────────────────────────────────
  const planEl = document.getElementById('plan-block');
  const plan   = generatePlan(d, dsMap, monthInc, r.saldo);
  planEl.innerHTML = renderPlan(plan, d.debts || [], dsMap, cost, metaVal);
  planEl.hidden    = false;

  // ── Realism check ────────────────────────────────────────
  const rcEl = document.getElementById('realism-check');
  if (health.months < 2 && monthOut > cost * 0.3) {
    rcEl.innerHTML = `<div class="alert al-warn" style="margin:0 16px 12px">
      ${SVG.warn}
      <div class="alert-body"><strong>Reserva baixa e gastos acima do necessário.</strong><br>
      Priorize a reserva antes de gastos livres.</div>
    </div>`;
    rcEl.hidden = false;
  } else {
    rcEl.hidden = true;
  }
}

// ── Renderiza plano com frases e barra segmentada ─────────────
function renderPlan(plan, debts, dsMap, monthlyCostTotal, metaFull) {
  const hasIncome = plan.income > 0;
  const totalDebt = currentDebtTotal(debts, dsMap);

  let html = `<div class="sh">Plano do mês</div><div class="plan-card">`;

  if (!hasIncome) {
    // ── Sem renda ─────────────────────────────────────────
    html += `
    <div class="plan-no-income">
      <div class="plan-no-income-ico">${SVG.alert}</div>
      <div>
        <div style="font-size:.88rem;font-weight:600;color:var(--danger)">Mês sem comissão registrada</div>
        <div style="font-size:.8rem;color:var(--txt2);margin-top:3px">
          A reserva cobre as despesas do mês. Registre um recebimento em Obras quando chegar uma comissão.
        </div>
      </div>
    </div>
    <div style="border-top:1px solid var(--border);margin:4px 0"></div>
    <div class="plan-step">
      <div class="plan-step-num">—</div>
      <div class="plan-step-body">
        <div class="plan-step-title">Custo mensal (sai da reserva)</div>
        <div class="plan-step-phrase">Fixas + parcelas de dívidas.</div>
      </div>
      <div class="plan-step-val neg">${fmt(monthlyCostTotal)}</div>
    </div>`;

  } else {
    // ── Com renda — cascata completa ──────────────────────
    if (plan.deficit > 0) {
      html += `<div class="alert al-danger" style="margin:8px 8px 4px;border-radius:var(--r-sm)">
        ${SVG.alert}<div class="alert-body">
          <strong>Renda insuficiente este mês.</strong><br>
          Faltam ${fmt(plan.deficit)} para cobrir as obrigações. Sugestão: cobrir pela reserva e manter dívidas no mínimo.
        </div></div>`;
    }

    // Passo 1 — Fixas
    if (plan.toFixas > 0) {
      const names = plan.fixasList.slice(0,3).map(f=>f.name).join(', ');
      html += step(1, 'Contas fixas', names || 'contas do mês',
        `Compromissos fixos do mês.`,
        plan.toFixas, 'var(--txt2)', false);
    }

    // Passo 2 — Parcelas mínimas
    if (plan.toDebtMin > 0) {
      const focusLine = plan.targetDebt
        ? `Foco: ${plan.targetDebt.name} (método ${plan.debtMethod === 'avalanche' ? 'avalanche — maior juro' : 'bola de neve — menor saldo'})${plan.projDebtMonths ? `. Quitação estimada: ~${plan.projDebtMonths} meses.` : '.'}`
        : '';
      html += step(2, 'Parcelas mínimas de dívidas',
        plan.debtMinList.map(d=>d.name).join(', '),
        `Manter dívidas em dia. ${focusLine}`,
        plan.toDebtMin, 'var(--warn)', false);
    } else if (plan.deficit > 0 && debts.length > 0) {
      html += step(2, 'Parcelas de dívidas', 'descoberto',
        'Renda insuficiente. Negocie mínimos com credores.', 0, 'var(--danger)', true);
    }

    // Passo 3 — Reserva urgente
    if (plan.toReserveUrgent > 0) {
      html += step(3, 'Reserva — urgente',
        `Reserva abaixo de 1 mês de custo`,
        `Prioridade máxima: elevar reserva para cobrir ao menos 1 mês (${fmt(plan.meta1)}).`,
        plan.toReserveUrgent, 'var(--danger)', true);
    }

    // Passo 4 — Aceleração
    if (plan.toDebtExtra > 0 && plan.targetDebt) {
      const method = plan.debtMethod === 'avalanche' ? 'Avalanche — quitando a dívida de maior juro primeiro.' : 'Bola de neve — quitando a dívida de menor saldo primeiro.';
      html += step(4, `Acelerar: ${plan.targetDebt.name}`,
        `${fmt(plan.targetDebt.currentBalance)} restando`,
        method,
        plan.toDebtExtra, 'var(--warn)', false);
    }

    // Passo 5 — Reserva completa
    if (plan.toReserveFull > 0) {
      const falta = Math.max(0, metaFull - plan.reserveSaldo);
      html += step(5, 'Reserva — completar meta',
        `Meta: ${fmt(metaFull)} · faltam ${fmt(falta)}`,
        `Para sua reserva chegar a ${plan.meta1 > 0 ? Math.round(metaFull / plan.meta1) : '?'} meses de custo.`,
        plan.toReserveFull, 'var(--teal)', false);
    }

    // Passo 6 — Livre / Objetivos
    const totalFree = plan.toGoals + plan.toFree;
    if (totalFree > 0) {
      const phrase = plan.reserveComplete
        ? `Reserva completa. 50% para objetivos (${fmt(plan.toGoals)}) · 50% livre (${fmt(plan.toFree)}).`
        : `Limite para gastos do dia a dia este mês. Reserva ainda incompleta — contenha os gastos livres.`;
      html += step(6, plan.reserveComplete ? 'Objetivos + livre' : 'Livre (reserva incompleta)',
        plan.reserveComplete ? 'reserva 100% atingida' : 'priorize a reserva',
        phrase,
        totalFree, plan.reserveComplete ? 'var(--teal)' : 'var(--txt3)', false);
    }
  }

  html += `</div>`;

  // ── Barra segmentada ──────────────────────────────────────
  if (hasIncome && plan.income > 0) {
    const inc  = plan.income;
    const segs = [
      { label:'Fixas',   val: plan.toFixas,                      color:'#475569' },
      { label:'Dívidas', val: plan.toDebtMin + plan.toDebtExtra, color:'#F59E0B' },
      { label:'Reserva', val: plan.toReserveTotal,               color:'#00E5A0' },
      { label:'Livre',   val: plan.toGoals + plan.toFree,        color:'#2D3748' },
    ].filter(s => s.val > 0);

    if (segs.length) {
      html += `<div style="margin:0 16px">
        <div class="plan-seg-bar">
          ${segs.map(s=>`<div class="plan-seg" style="flex:${s.val/inc*100};background:${s.color}" title="${s.label}: ${fmt(s.val)}"></div>`).join('')}
        </div>
        <div class="plan-seg-legend">
          ${segs.map(s=>`<div class="plan-seg-lbl"><span class="plan-seg-dot" style="background:${s.color}"></span>${s.label} ${(s.val/inc*100).toFixed(0)}%</div>`).join('')}
        </div>
      </div>`;
    }
  }

  // ── Projeções ─────────────────────────────────────────────
  const projRows = [];
  if (totalDebt > 0) {
    const dm = plan.projDebtMonths;
    projRows.push({
      label: 'Dívidas zeradas em',
      value: dm === 0 ? 'Já quitado' : dm === null ? '> 30 anos' : `~${dm} meses`,
      color: dm === 0 ? 'var(--teal)' : dm && dm <= 18 ? 'var(--teal)' : 'var(--warn)',
    });
  }
  if (plan.reserveSaldo < metaFull) {
    const rm = plan.projReserveMonths;
    projRows.push({
      label: 'Reserva completa em',
      value: rm === null ? 'Sem aporte previsto' : rm === 0 ? 'Meta atingida' : `~${rm} meses`,
      color: rm === null ? 'var(--txt3)' : rm <= 12 ? 'var(--teal)' : 'var(--warn)',
    });
  } else {
    projRows.push({ label: 'Reserva', value: 'Meta atingida', color: 'var(--teal)' });
  }

  if (projRows.length) {
    html += `<div class="sh" style="margin-top:4px">Projeção</div>
    <div class="plan-proj-row">
      ${projRows.map(r=>`<div class="plan-proj-item">
        <div class="plan-proj-lbl">${r.label}</div>
        <div class="plan-proj-val" style="color:${r.color}">${r.value}</div>
      </div>`).join('')}
    </div>`;
  }

  if (totalDebt > 0) {
    html += `<div style="margin:0 16px 16px">
      <div style="display:flex;justify-content:space-between;align-items:center;
                  background:var(--bg-raise);border-radius:var(--r-sm);padding:10px 12px">
        <span style="font-size:.8rem;color:var(--txt2)">Dívida total atual</span>
        <span class="num fw7 warn" style="font-size:.95rem">${fmt(totalDebt)}</span>
      </div>
    </div>`;
  }

  html += `<div class="disclaimer" style="margin:0 16px 8px">
    ${SVG.info} Plano estimado com base nos seus dados. Não substitui orientação de um profissional financeiro.
  </div>`;

  return html;
}

function step(num, title, sub, phrase, value, color, urgent) {
  return `
  <div class="plan-step${urgent ? ' plan-step-urgent' : ''}">
    <div class="plan-step-num">${num}</div>
    <div class="plan-step-body">
      <div class="plan-step-title">${title}</div>
      ${sub    ? `<div class="plan-step-sub">${sub}</div>` : ''}
      ${phrase ? `<div class="plan-step-phrase">${phrase}</div>` : ''}
    </div>
    <div class="plan-step-val" style="color:${color}">${fmt(value)}</div>
  </div>`;
}

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
