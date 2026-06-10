/**
 * month.js — visão mensal de gastos + histórico de reserva
 */
import { getTx, removeTx, getContracts, getParams, getReserve } from '../storage.js';
import { fmtBRL, ymNow, ymLabel, totalComissoesDoMes, sumTx, sumByCategory } from '../calc.js';
import { CAT_ICONS } from './launch.js';
import { renderReserveLine, renderMonthBar, renderCategoryDonut } from '../charts.js';

let activeYM    = ymNow();
let onChanged   = null;

export function initMonth(changedCb) {
  onChanged = changedCb;
}

export function renderMonth() {
  activeYM = ymNow(); // always start on current month
  buildMonthPills();
  renderMonthData();
}

function buildMonthPills() {
  const wrap = document.getElementById('month-pills');
  wrap.innerHTML = '';
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const ym  = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const btn = document.createElement('button');
    btn.className   = 'month-pill' + (ym === activeYM ? ' active' : '');
    btn.textContent = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.','');
    btn.dataset.ym  = ym;
    btn.addEventListener('click', () => { activeYM = ym; buildMonthPills(); renderMonthData(); });
    wrap.appendChild(btn);
  }
}

function renderMonthData() {
  const txs       = getTx(activeYM);
  const contracts = getContracts();
  const params    = getParams();

  const totalEntrou = totalComissoesDoMes(contracts, params, activeYM);
  const totalSaiu   = sumTx(txs);
  const saldo       = totalEntrou - totalSaiu;

  document.getElementById('month-entrou').textContent = fmtBRL(totalEntrou);
  document.getElementById('month-saiu').textContent   = fmtBRL(totalSaiu);
  const saldoEl = document.getElementById('month-saldo');
  saldoEl.textContent = fmtBRL(saldo);
  saldoEl.className   = `stat-val num ${saldo >= 0 ? 'positive' : 'negative'}`;

  renderTxList(txs);
  renderCategoryChart(txs);
  renderHistoryCharts();
}

function renderTxList(txs) {
  const list = document.getElementById('month-tx-list');
  if (txs.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
        </div>
        <div class="empty-title">Nenhum lançamento</div>
        <div class="empty-sub">Use o botão Lançar para registrar gastos.</div>
      </div>`;
    return;
  }

  const sorted = [...txs].sort((a,b) => b.data.localeCompare(a.data));
  list.innerHTML = sorted.map(tx => {
    const d   = new Date(tx.data + 'T12:00:00').toLocaleDateString('pt-BR', { day:'2-digit', month:'short' });
    const ico = CAT_ICONS[tx.categoria] || CAT_ICONS.outros;
    return `
      <div class="tx-item">
        <div class="tx-icon">${ico}</div>
        <div class="tx-body">
          <div class="tx-desc">${escHtml(tx.descricao)}</div>
          <div class="tx-meta">${d} · ${catLabel(tx.categoria)}</div>
        </div>
        <div class="tx-amount">− ${fmtBRL(tx.valor)}</div>
        <button class="tx-del" data-id="${tx.id}" data-ym="${tx.data.slice(0,7)}" title="Remover">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </div>`;
  }).join('');

  list.querySelectorAll('.tx-del').forEach(btn => {
    btn.addEventListener('click', () => {
      removeTx(btn.dataset.id, btn.dataset.ym);
      renderMonthData();
      if (onChanged) onChanged();
    });
  });
}

function renderCategoryChart(txs) {
  const catMap = sumByCategory(txs);
  if (catMap.size === 0) {
    document.getElementById('month-chart-wrap').innerHTML = `
      <div class="empty-state" style="padding:24px">
        <div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 13s1.5 2 4 2 4-2 4-2"/></svg></div>
        <div class="empty-sub">Sem gastos para exibir</div>
      </div>`;
    return;
  }
  // top 6
  const sorted = [...catMap.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6);
  const labels = sorted.map(([k]) => catLabel(k));
  const values = sorted.map(([,v]) => v);
  document.getElementById('month-chart-wrap').innerHTML = `<canvas id="chart-donut"></canvas>`;
  renderCategoryDonut('chart-donut', labels, values);
}

function renderHistoryCharts() {
  const contracts = getContracts();
  const params    = getParams();
  const reserve   = getReserve();

  const months = [], entrou = [], saiu = [], saldos = [];
  for (let i = 5; i >= 0; i--) {
    const d  = new Date();
    d.setMonth(d.getMonth() - i);
    const ym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    months.push(d.toLocaleDateString('pt-BR', { month:'short' }).replace('.',''));
    entrou.push(totalComissoesDoMes(contracts, params, ym));
    saiu.push(sumTx(getTx(ym)));
  }

  // reserva: reconstruir saldo mês a mês a partir do histórico
  const hist = reserve.historico || [];
  let saldoAcc = reserve.saldo;
  // trabalhar de trás pra frente
  const histByYM = {};
  hist.forEach(h => { histByYM[h.ym] = (histByYM[h.ym] || 0) + h.delta; });
  const allYMs = months.map((_,i) => {
    const d = new Date(); d.setMonth(d.getMonth() - (5-i));
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  });
  // acumulado simples: usar saldo atual projetado para trás
  let running = reserve.saldo;
  const saldoArr = new Array(6);
  for (let i = 5; i >= 0; i--) {
    const ym = allYMs[i];
    saldoArr[i] = running;
    running -= (histByYM[ym] || 0);
  }

  renderMonthBar('chart-bar-history', months, entrou, saiu);
  renderReserveLine('chart-reserve-line', months, saldoArr);
}

function catLabel(id) {
  const map = {
    mercado:'Mercado',moradia:'Moradia',transporte:'Transporte',
    saude:'Saúde',educacao:'Educação',lazer:'Lazer',
    reserva:'Reserva',outros:'Outros',
  };
  return map[id] || id;
}

function escHtml(str) {
  return (str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
