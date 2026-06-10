/**
 * diagnosis.js — onboarding em 6 passos
 */
import { setDiagnosis, setReserveSaldo, getParams } from '../storage.js';
import { calcCustoMensal, fmtBRL } from '../calc.js';

const TOTAL_STEPS = 6;
let step = 1;
let onComplete = null; // callback(diagnosis)

export function initDiagnosis(completeCb) {
  onComplete = completeCb;

  document.getElementById('btn-diag-next').addEventListener('click', handleNext);
  document.getElementById('btn-diag-prev').addEventListener('click', handlePrev);
  document.getElementById('btn-add-fixa').addEventListener('click', () => addDynRow('fixas-list', fixaRow));
  document.getElementById('btn-add-divida').addEventListener('click', () => addDynRow('dividas-list', dividaRow));

  renderStep();
}

export function startDiagnosis() {
  step = 1;
  renderStep();
}

function renderStep() {
  document.querySelectorAll('.diag-step').forEach(s => s.classList.remove('active'));
  document.getElementById(`diag-step-${step}`)?.classList.add('active');

  const pct = (step / TOTAL_STEPS) * 100;
  document.getElementById('diag-progress-fill').style.width = `${pct}%`;
  document.getElementById('diag-step-label').textContent = `Etapa ${step} de ${TOTAL_STEPS}`;

  const prevBtn = document.getElementById('btn-diag-prev');
  prevBtn.style.display = step === 1 ? 'none' : '';

  const nextBtn = document.getElementById('btn-diag-next');
  nextBtn.textContent = step === TOTAL_STEPS ? 'Gerar plano' : 'Continuar';

  // step 5: atualiza cálculo da meta em tempo real
  if (step === 5) updateMetaPreview();
}

function handleNext() {
  if (!validate()) return;
  if (step < TOTAL_STEPS) { step++; renderStep(); }
  else finish();
}

function handlePrev() {
  if (step > 1) { step--; renderStep(); }
}

// ── Validation ────────────────────────────────────────────────
function validate() {
  if (step === 1) {
    const v = parseFloat(document.getElementById('media-renda').value);
    if (!v || v <= 0) { markError('media-renda'); return false; }
  }
  if (step === 4) {
    const v = parseFloat(document.getElementById('reserva-atual').value);
    if (isNaN(v) || v < 0) { markError('reserva-atual'); return false; }
  }
  if (step === 5) {
    const m = parseInt(document.getElementById('meta-meses').value);
    if (!m || m < 1 || m > 36) { markError('meta-meses'); return false; }
  }
  return true;
}

function markError(id) {
  const el = document.getElementById(id);
  el?.classList.add('error');
  el?.focus();
  setTimeout(() => el?.classList.remove('error'), 2000);
}

// ── Dynamic rows ──────────────────────────────────────────────
function fixaRow() {
  return `
    <div class="dyn-item-body">
      <input placeholder="Nome (ex: Aluguel)" class="fixa-nome" maxlength="50" />
      <div class="dyn-item-row">
        <input type="number" placeholder="Valor R$" class="fixa-valor" min="0" step="0.01" inputmode="decimal" />
        <input type="number" placeholder="Dia venc." class="fixa-dia" min="1" max="31" style="max-width:80px" inputmode="numeric" />
      </div>
    </div>`;
}

function dividaRow() {
  return `
    <div class="dyn-item-body">
      <input placeholder="Nome (ex: Cartão Nubank)" class="div-nome" maxlength="50" />
      <div class="dyn-item-row">
        <input type="number" placeholder="Parcela R$" class="div-parcela" min="0" step="0.01" inputmode="decimal" />
        <input type="number" placeholder="Saldo total R$" class="div-saldo" min="0" step="0.01" inputmode="decimal" />
      </div>
    </div>`;
}

function addDynRow(listId, templateFn) {
  const list = document.getElementById(listId);
  const div  = document.createElement('div');
  div.className = 'dyn-item';
  div.innerHTML = templateFn() + removeBtn();
  div.querySelector('.dyn-remove').addEventListener('click', () => div.remove());
  list.appendChild(div);
  div.querySelector('input')?.focus();
}

function removeBtn() {
  return `<button class="dyn-remove" type="button" title="Remover">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
  </button>`;
}

// ── Meta preview (step 5) ─────────────────────────────────────
function updateMetaPreview() {
  const meses = parseInt(document.getElementById('meta-meses').value) || 6;
  const diag  = readPartialDiagnosis();
  const { total } = calcCustoMensal(diag);
  const alvo  = total * meses;
  const preview = document.getElementById('meta-preview');
  if (preview) {
    preview.textContent = alvo > 0
      ? `Meta de reserva: ${fmtBRL(alvo)} (${meses}× ${fmtBRL(total)}/mês)`
      : `Informe suas contas fixas primeiro.`;
  }
  document.getElementById('meta-meses')
    ?.addEventListener('input', () => {
      const m2 = parseInt(document.getElementById('meta-meses').value) || 0;
      const a2 = total * m2;
      if (preview && a2 > 0) preview.textContent = `Meta de reserva: ${fmtBRL(a2)} (${m2}× ${fmtBRL(total)}/mês)`;
    }, { once: true });
}

// ── Read form data ────────────────────────────────────────────
function readPartialDiagnosis() {
  const fixas = [...document.querySelectorAll('#fixas-list .dyn-item')].map(li => ({
    nome:  li.querySelector('.fixa-nome')?.value.trim() || 'Conta',
    valor: parseFloat(li.querySelector('.fixa-valor')?.value) || 0,
    dia:   parseInt(li.querySelector('.fixa-dia')?.value) || 1,
  })).filter(f => f.valor > 0);

  const dividas = [...document.querySelectorAll('#dividas-list .dyn-item')].map(li => ({
    nome:    li.querySelector('.div-nome')?.value.trim() || 'Dívida',
    parcela: parseFloat(li.querySelector('.div-parcela')?.value) || 0,
    saldo:   parseFloat(li.querySelector('.div-saldo')?.value) || 0,
  })).filter(d => d.parcela > 0);

  return { fixas, dividas };
}

function finish() {
  const partial  = readPartialDiagnosis();
  const mediaRenda  = parseFloat(document.getElementById('media-renda').value) || 0;
  const piorMes     = parseFloat(document.getElementById('pior-mes').value) || 0;
  const reservaAtual = parseFloat(document.getElementById('reserva-atual').value) || 0;
  const metaMeses   = parseInt(document.getElementById('meta-meses').value) || 6;
  const objetivos   = [...document.querySelectorAll('#objetivos-list input:checked')].map(c => c.value);

  const diagnosis = {
    ...partial,
    mediaRenda, piorMes,
    reservaAtual, metaMeses, objetivos,
    criadoEm: new Date().toISOString(),
  };

  setDiagnosis(diagnosis);
  setReserveSaldo(reservaAtual);

  if (onComplete) onComplete(diagnosis);
}
