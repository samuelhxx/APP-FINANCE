/**
 * month.js — monthly view: stats + tx list + charts
 */
import { tx as txStore, contracts as ctStore, params as paramsStore, reserve as resStore } from '../storage.js';
import { fmt, ymNow, ymLabel, incomeOfMonth, sumTx, byCategory } from '../calc.js';
import { CAT_ICON, CATS } from './launch.js';
import { lineReserve, barHistory, donutCats, killAll } from '../charts.js';

let activeYM = ymNow();
let _onChanged = null;

export function initMonth(onChanged) { _onChanged = onChanged; }

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
    const d  = new Date();
    d.setMonth(d.getMonth() - i);
    const ym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const b  = document.createElement('button');
    b.className   = 'month-pill' + (ym === activeYM ? ' active' : '');
    b.textContent = d.toLocaleDateString('pt-BR',{month:'short',year:'2-digit'}).replace('.','');
    b.dataset.ym  = ym;
    b.addEventListener('click', () => { activeYM=ym; buildPills(); renderData(); });
    wrap.appendChild(b);
  }
}

function renderData() {
  const txs = txStore.get(activeYM);
  const p   = paramsStore.get();
  const ct  = ctStore.get();

  const inc  = incomeOfMonth(ct, p, activeYM);
  const out  = sumTx(txs);
  const bal  = inc - out;

  const setEl = (id, text, cls='') => {
    const e = document.getElementById(id);
    if (e) { e.textContent=text; e.className=`stat-val num ${cls}`.trim(); }
  };
  setEl('m-income', fmt(inc), inc>0?'pos':'');
  setEl('m-out',    fmt(out), out>0?'neg':'');
  setEl('m-bal',    fmt(bal), bal>=0?'pos':'neg');

  renderTxList(txs);
  renderCharts(txs, ct, p);
}

function renderTxList(txs) {
  const el = document.getElementById('month-txs');
  if (!el) return;
  if (!txs.length) {
    el.innerHTML = `<div class="empty" style="padding:32px 20px">
      <div class="empty-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg></div>
      <div class="empty-title">Nenhum lançamento</div>
      <div class="empty-sub">Use o botão Lançar para registrar gastos.</div>
    </div>`; return;
  }

  const sorted = [...txs].sort((a,b)=>b.date.localeCompare(a.date));
  el.innerHTML = sorted.map(t => {
    const d   = new Date(t.date+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short'});
    const ico = CAT_ICON[t.cat] || CAT_ICON.outros;
    const lbl = CATS.find(c=>c.id===t.cat)?.label || t.cat;
    return `<div class="tx-item">
      <div class="tx-ico">${ico}</div>
      <div class="tx-body">
        <div class="tx-desc">${esc(t.desc)}</div>
        <div class="tx-meta">${d} · ${lbl}</div>
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

function renderCharts(txs, ct, p) {
  // Donut
  const catMap = byCategory(txs);
  const catWrap = document.getElementById('month-donut-wrap');
  if (!catMap || Object.keys(catMap).length === 0) {
    if (catWrap) catWrap.innerHTML = `<div class="empty" style="padding:24px"><div class="empty-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg></div><div class="empty-sub">Sem gastos para exibir</div></div>`;
  } else {
    const sorted = Object.entries(catMap).sort((a,b)=>b[1]-a[1]).slice(0,6);
    if (catWrap) catWrap.innerHTML = `<canvas id="chart-donut"></canvas>`;
    donutCats('chart-donut', sorted.map(([k])=>CATS.find(c=>c.id===k)?.label||k), sorted.map(([,v])=>v));
  }

  // 6-month bar + line
  const months=[], income=[], spent=[], saldos=[];
  const reserve = resStore.get();
  const histMap = {};
  (reserve.log||[]).forEach(h => { histMap[h.ym]=(histMap[h.ym]||0)+h.delta; });

  let running = reserve.saldo;
  const yms = [];
  for (let i=5;i>=0;i--) {
    const d=new Date(); d.setMonth(d.getMonth()-i);
    yms.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  }
  const saldoArr = new Array(6);
  for (let i=5;i>=0;i--) { saldoArr[i]=running; running-=(histMap[yms[i]]||0); }

  for (let i=0;i<6;i++) {
    const d=new Date(); d.setMonth(d.getMonth()-(5-i));
    months.push(d.toLocaleDateString('pt-BR',{month:'short'}).replace('.',''));
    income.push(incomeOfMonth(ct,p,yms[i]));
    spent.push(sumTx(txStore.get(yms[i])));
    saldos.push(saldoArr[i]);
  }

  barHistory('chart-bar-hist', months, income, spent);
  lineReserve('chart-line-res', months, saldos);
}

function esc(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
