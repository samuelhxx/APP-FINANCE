/**
 * settings.js — parâmetros de comissão + reset de dados
 */
import { getParams, setParams, getDiagnosis, clearAll } from '../storage.js';
import { calcCustoMensal, fmtBRL } from '../calc.js';

let onChanged = null;

export function initSettings(changedCb) {
  onChanged = changedCb;
  document.getElementById('btn-save-params')?.addEventListener('click', saveParams);
  document.getElementById('btn-reset-all')?.addEventListener('click', resetAll);
}

export function renderSettings() {
  const params = getParams();
  const diag   = getDiagnosis();

  const el = id => document.getElementById(id);
  if (el('param-pct'))   el('param-pct').value   = params.commission_pct;
  if (el('param-fixed')) el('param-fixed').value  = params.commission_fixed;
  if (el('param-months')) el('param-months').value = params.reserve_months;

  // summary
  if (diag) {
    const { fixas, dividas, total } = calcCustoMensal(diag);
    const metaValor = total * diag.metaMeses;
    const wrap = el('settings-diag-summary');
    if (wrap) {
      wrap.innerHTML = `
        <div class="card" style="margin:0 16px">
          <div class="settings-row">
            <div><div class="settings-row-label">Custo mensal (fixas)</div></div>
            <span class="num fw-700">${fmtBRL(fixas)}</span>
          </div>
          <div class="settings-row">
            <div><div class="settings-row-label">Custo mensal (dívidas)</div></div>
            <span class="num fw-700">${fmtBRL(dividas)}</span>
          </div>
          <div class="settings-row">
            <div><div class="settings-row-label">Total compromissos/mês</div></div>
            <span class="num fw-700">${fmtBRL(total)}</span>
          </div>
          <div class="settings-row">
            <div><div class="settings-row-label">Meta de reserva (${diag.metaMeses}×)</div></div>
            <span class="num fw-700 text-teal">${fmtBRL(metaValor)}</span>
          </div>
        </div>`;
    }
  }
}

function saveParams() {
  const pct   = parseFloat(document.getElementById('param-pct')?.value);
  const fixed = parseFloat(document.getElementById('param-fixed')?.value);
  const months = parseInt(document.getElementById('param-months')?.value);

  if (isNaN(pct)   || pct < 0)    { markError('param-pct'); return; }
  if (isNaN(fixed) || fixed < 0)  { markError('param-fixed'); return; }
  if (isNaN(months) || months < 1) { markError('param-months'); return; }

  setParams({ commission_pct: pct, commission_fixed: fixed, reserve_months: months });

  const btn = document.getElementById('btn-save-params');
  const orig = btn.textContent;
  btn.textContent = 'Salvo';
  setTimeout(() => { btn.textContent = orig; }, 1500);

  if (onChanged) onChanged();
}

function markError(id) {
  const el = document.getElementById(id);
  el?.classList.add('error');
  el?.focus();
  setTimeout(() => el?.classList.remove('error'), 2000);
}

function resetAll() {
  if (!confirm('Apagar todos os dados? Essa ação é irreversível.')) return;
  clearAll();
  location.reload();
}
