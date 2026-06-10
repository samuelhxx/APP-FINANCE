/**
 * diagnosis.js — 6-step onboarding flow
 */
import { diag, reserve as resStore, params } from '../storage.js';
import { monthlyCost, fmt, uid } from '../calc.js';
import { navigate } from '../router.js';

const TOTAL = 6;
let step = 1;

export function initDiagnosis() {
  q('btn-next').addEventListener('click', next);
  q('btn-prev').addEventListener('click', prev);
  q('btn-add-fixa').addEventListener('click', () => addRow('fixas-list', fixaRow));
  q('btn-add-debt').addEventListener('click',  () => addRow('debts-list', debtRow));
  q('meta-months').addEventListener('input', updateMetaPreview);
}

export function startDiagnosis() {
  step = 1;
  renderStep();
}

function next() {
  if (!validate()) return;
  if (step < TOTAL) { step++; renderStep(); }
  else finish();
}

function prev() { if (step > 1) { step--; renderStep(); } }

function renderStep() {
  document.querySelectorAll('.diag-step').forEach(s => s.classList.remove('active'));
  q(`step-${step}`)?.classList.add('active');
  q('prog-fill').style.width = `${step/TOTAL*100}%`;
  q('prog-lbl').textContent  = `Etapa ${step} de ${TOTAL}`;
  q('btn-prev').style.display = step === 1 ? 'none' : '';
  q('btn-next').textContent   = step === TOTAL ? 'Gerar plano' : 'Continuar';
  if (step === 5) updateMetaPreview();
}

function validate() {
  if (step === 1) {
    const v = parseFloat(q('avg-income').value);
    if (!v || v <= 0) { err('avg-income'); return false; }
  }
  if (step === 4) {
    const v = parseFloat(q('reserve-now').value);
    if (isNaN(v) || v < 0) { err('reserve-now'); return false; }
  }
  if (step === 5) {
    const v = parseInt(q('meta-months').value);
    if (!v || v < 1) { err('meta-months'); return false; }
  }
  return true;
}

// ── Dynamic rows ──────────────────────────────────────────────
function fixaRow() {
  return `<div class="dyn-body">
    <input placeholder="Nome (ex: Aluguel)" class="fixa-name" maxlength="50"/>
    <div class="dyn-row">
      <input type="number" placeholder="Valor R$" class="fixa-val" min="0" step=".01" inputmode="decimal"/>
      <input type="number" placeholder="Dia venc." class="fixa-day" min="1" max="31" style="max-width:80px" inputmode="numeric"/>
    </div>
  </div>`;
}

function debtRow() {
  return `<div class="dyn-body">
    <input placeholder="Nome (ex: Cartão Nubank)" class="debt-name" maxlength="50"/>
    <div class="dyn-row">
      <input type="number" placeholder="Parcela R$" class="debt-inst" min="0" step=".01" inputmode="decimal"/>
      <input type="number" placeholder="Saldo R$" class="debt-bal" min="0" step=".01" inputmode="decimal"/>
    </div>
  </div>`;
}

function addRow(listId, tplFn) {
  const list = document.getElementById(listId);
  const div  = document.createElement('div');
  div.className = 'dyn-item';
  div.innerHTML = tplFn() + `<button class="dyn-rm" type="button" aria-label="Remover">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg></button>`;
  div.querySelector('.dyn-rm').onclick = () => div.remove();
  list.appendChild(div);
  div.querySelector('input')?.focus();
}

function updateMetaPreview() {
  const m    = parseInt(q('meta-months').value) || 0;
  const d    = readPartial();
  const { total } = monthlyCost(d);
  const el   = q('meta-preview');
  if (el) el.textContent = total > 0 && m > 0
    ? `Meta: ${fmt(total * m)} (${m}× ${fmt(total)}/mês)`
    : '';
}

// ── Read form ─────────────────────────────────────────────────
function readPartial() {
  const fixas = [...document.querySelectorAll('#fixas-list .dyn-item')].map(li => ({
    id:    uid(),
    name:  li.querySelector('.fixa-name')?.value.trim() || 'Conta',
    value: parseFloat(li.querySelector('.fixa-val')?.value)  || 0,
    day:   parseInt(li.querySelector('.fixa-day')?.value)    || 1,
  })).filter(f => f.value > 0);

  const debts = [...document.querySelectorAll('#debts-list .dyn-item')].map(li => ({
    id:          uid(),
    name:        li.querySelector('.debt-name')?.value.trim() || 'Dívida',
    installment: parseFloat(li.querySelector('.debt-inst')?.value) || 0,
    balance:     parseFloat(li.querySelector('.debt-bal')?.value)  || 0,
  })).filter(d => d.installment > 0);

  return { fixas, debts };
}

function finish() {
  const partial    = readPartial();
  const avgIncome  = parseFloat(q('avg-income').value)   || 0;
  const worstMonth = parseFloat(q('worst-month').value)  || 0;
  const reserveNow = parseFloat(q('reserve-now').value)  || 0;
  const metaMonths = parseInt(q('meta-months').value)    || 6;
  const goals      = [...document.querySelectorAll('#goals-list input:checked')].map(c => c.value);

  diag.set({ ...partial, avgIncome, worstMonth, metaMonths, goals, createdAt: new Date().toISOString() });
  resStore.setSaldo(reserveNow);
  navigate('reserve');
}

// ── Helpers ───────────────────────────────────────────────────
function q(id) { return document.getElementById(id); }
function err(id) {
  const el = document.getElementById(id);
  el?.classList.add('err');
  el?.focus();
  setTimeout(() => el?.classList.remove('err'), 2000);
}
