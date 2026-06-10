/**
 * reserve.js — dashboard principal: medidor de reserva + plano do mês
 */
import { getDiagnosis, getReserve, getContracts, getParams, getTx } from '../storage.js';
import {
  fmtBRL, ymNow, ymLabel, reserveHealth, calcCustoMensal,
  totalComissoesDoMes, comissoesDoMes, planMonth, sumTx,
} from '../calc.js';

export function renderReserve() {
  const diag      = getDiagnosis();
  const reserve   = getReserve();
  const params    = getParams();
  const contracts = getContracts();
  const ym        = ymNow();
  const txs       = getTx(ym);

  if (!diag) return;

  const { total: custoMensal } = calcCustoMensal(diag);
  const reservaMeta = custoMensal * diag.metaMeses;
  const saldo       = reserve.saldo;
  const health      = reserveHealth(saldo, custoMensal, diag.metaMeses);
  const comissoes   = comissoesDoMes(contracts, params, ym);
  const totalEntrou = totalComissoesDoMes(contracts, params, ym);
  const totalSaiu   = sumTx(txs);
  const temRenda    = comissoes.length > 0;

  // ── Medidor de reserva ────────────────────────────────────
  const meter = document.getElementById('reserve-meter');
  meter.innerHTML = `
    <div class="meter-label">Reserva cobre</div>
    <div class="meter-value ${health.status}">
      ${health.meses.toFixed(1)} <span style="font-size:1rem;font-weight:500;color:var(--txt-2)">meses</span>
    </div>
    <div class="meter-sub">
      ${fmtBRL(saldo)} guardados · meta: ${diag.metaMeses} meses (${fmtBRL(reservaMeta)})
    </div>
    <div class="meter-bar-wrap">
      <div class="meter-bar-fill ${health.status}" style="width:${health.pct}%"></div>
    </div>
    <div class="meter-row">
      <span>${ymLabel(ym, { month: 'long', year: 'numeric' })}</span>
      <span>${health.pct.toFixed(0)}% da meta</span>
    </div>`;

  // ── Alerta do mês ─────────────────────────────────────────
  const alertBox = document.getElementById('reserve-alert');
  if (!temRenda) {
    alertBox.innerHTML = `
      <div class="alert alert-danger">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <div class="alert-body">
          <strong>Nenhuma comissão prevista este mês.</strong><br>
          Suas contas (${fmtBRL(custoMensal)}) serão cobertas pela reserva.
          ${saldo < custoMensal ? `<br><strong>Atenção: reserva insuficiente para cobrir o mês.</strong>` : ''}
        </div>
      </div>`;
    alertBox.style.display = '';
  } else if (health.status !== 'healthy') {
    alertBox.innerHTML = `
      <div class="alert alert-warn">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <div class="alert-body">
          <strong>Mês bom: aproveite para encher a reserva.</strong><br>
          Reserva ainda abaixo da meta. Priorize encher antes de gastos livres.
        </div>
      </div>`;
    alertBox.style.display = '';
  } else {
    alertBox.style.display = 'none';
  }

  // ── Stats do mês ──────────────────────────────────────────
  const saldo_mes = totalEntrou - totalSaiu;
  document.getElementById('stat-entrou').textContent = fmtBRL(totalEntrou);
  document.getElementById('stat-entrou').className   = `stat-val num ${totalEntrou > 0 ? 'positive' : ''}`;
  document.getElementById('stat-saiu').textContent   = fmtBRL(totalSaiu);
  document.getElementById('stat-saiu').className     = `stat-val num ${totalSaiu > 0 ? 'negative' : ''}`;
  document.getElementById('stat-saldo-mes').textContent = fmtBRL(saldo_mes);
  document.getElementById('stat-saldo-mes').className   = `stat-val num ${saldo_mes >= 0 ? 'positive' : 'negative'}`;

  // ── Plano sugerido ────────────────────────────────────────
  if (temRenda) {
    const { fixas, dividas, total } = calcCustoMensal(diag);
    const plan = planMonth(totalEntrou, total, saldo, reservaMeta, params);
    renderPlanSuggestion(plan, totalEntrou, { fixas, dividas, total }, reservaMeta, saldo, diag.metaMeses);
  } else {
    document.getElementById('plan-suggestion').innerHTML = '';
  }

  // ── Contador de contratos (stat card) ────────────────────
  const fechadosCount = contracts.filter(c => c.status === 'fechado').length;
  window._updateContractCount?.(fechadosCount);

  // ── Freio de realismo ─────────────────────────────────────
  renderRealismCheck(health, totalSaiu, custoMensal);
}

function renderPlanSuggestion(plan, entrou, custo, reservaMeta, saldoReserva, metaMeses) {
  const el = document.getElementById('plan-suggestion');
  if (!el) return;

  const rows = [
    { label: 'Contas fixas + dívidas', valor: custo.total, cor: 'var(--txt-2)' },
    { label: 'Para a reserva',         valor: plan.para_reserva,    cor: 'var(--teal)' },
    { label: 'Objetivos secundários',  valor: plan.para_objetivos,  cor: 'var(--warn)' },
    { label: 'Livre / outros',         valor: plan.para_livre,      cor: 'var(--txt-2)' },
  ].filter(r => r.valor > 0);

  const deficit = plan.deficit > 0
    ? `<div class="alert alert-danger" style="margin-top:12px">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <div class="alert-body"><strong>Comissão abaixo do custo do mês.</strong><br>Faltam ${fmtBRL(plan.deficit)} para cobrir compromissos. A diferença sairá da reserva.</div>
      </div>` : '';

  el.innerHTML = `
    <div class="section-head">Sugestão de distribuição</div>
    <div class="card card-p" style="margin:0 16px">
      ${rows.map(r => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)">
          <span style="font-size:.85rem;color:var(--txt-2)">${r.label}</span>
          <span class="num fw-700" style="color:${r.cor}">${fmtBRL(r.valor)}</span>
        </div>`).join('')}
    </div>
    ${deficit}
    <div class="disclaimer" style="margin-top:12px">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
      Estimativa com base nos seus dados. Não substitui orientação de um profissional financeiro.
    </div>`;
}

function renderRealismCheck(health, totalSaiu, custoMensal) {
  const el = document.getElementById('realism-check');
  if (!el) return;
  if (health.meses < 2 && totalSaiu > custoMensal * 0.3) {
    el.innerHTML = `
      <div class="alert alert-warn" style="margin:0 16px 12px">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <div class="alert-body">
          <strong>Reserva baixa e gastos acima do necessário.</strong><br>
          Priorize encher a reserva antes de gastos livres ou objetivos secundários.
        </div>
      </div>`;
    el.style.display = '';
  } else {
    el.style.display = 'none';
  }
}
