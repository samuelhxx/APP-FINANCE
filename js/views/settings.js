/**
 * settings.js — editable params + debt balances + data reset
 */
import { params as paramsStore, diag as diagStore, debtState as debtStateStore, clearAll } from '../storage.js';
import { monthlyCost, fmt, currentDebtTotal } from '../calc.js';

let _onChanged = null;

export function initSettings(onChanged) {
  _onChanged = onChanged;
  document.getElementById('btn-save-params')?.addEventListener('click', saveParams);
  document.getElementById('btn-reset')?.addEventListener('click', resetAll);
}

export function renderSettings() {
  const p = paramsStore.get();
  v('param-pct',    p.pct);
  v('param-fixed',  p.fixed);
  v('param-months', p.reserveMonths);

  const d    = diagStore.get();
  const wrap = document.getElementById('diag-summary');
  if (!wrap) return;
  if (!d) { wrap.innerHTML = ''; renderDebtBalances(null, null); return; }

  const { fixas, debts, total } = monthlyCost(d);
  const meta   = total * d.metaMonths;
  const dsMap  = debtStateStore.init(d.debts || []);
  const debtNow = currentDebtTotal(d.debts || [], dsMap);

  wrap.innerHTML = `
    <div class="s-group" style="margin:0 16px">
      <div class="s-row">
        <div><div class="s-row-lbl">Custo fixo mensal</div></div>
        <span class="num fw7">${fmt(fixas)}</span>
      </div>
      <div class="s-row">
        <div><div class="s-row-lbl">Parcelas de dívidas</div></div>
        <span class="num fw7">${fmt(debts)}</span>
      </div>
      <div class="s-row">
        <div><div class="s-row-lbl">Total compromissos/mês</div></div>
        <span class="num fw7">${fmt(total)}</span>
      </div>
      <div class="s-row">
        <div><div class="s-row-lbl">Meta de reserva (${d.metaMonths}×)</div></div>
        <span class="num fw7 teal">${fmt(meta)}</span>
      </div>
      ${debtNow > 0 ? `
      <div class="s-row">
        <div><div class="s-row-lbl">Dívida total atual</div></div>
        <span class="num fw7" style="color:var(--warn)">${fmt(debtNow)}</span>
      </div>` : ''}
    </div>`;

  renderDebtBalances(d.debts || [], dsMap);
}

function renderDebtBalances(debts, dsMap) {
  const wrap = document.getElementById('debt-balances');
  if (!wrap) return;

  if (!debts || !debts.length) {
    wrap.innerHTML = '';
    return;
  }

  wrap.innerHTML = `
    <div class="sh">Saldos das dívidas</div>
    <div class="s-group" style="margin:0 16px" id="debt-bal-list">
      ${debts.map(d => `
        <div class="s-row" style="align-items:center">
          <div style="flex:1;min-width:0">
            <div class="s-row-lbl">${esc(d.name)}</div>
            <div class="s-row-sub">Parcela: ${fmt(d.installment)}</div>
          </div>
          <div class="pfx" style="max-width:140px">
            <span class="pfx-sym" style="font-size:.78rem">R$</span>
            <input type="number" class="debt-bal-input" data-id="${d.id}"
              value="${(dsMap[d.id] ?? d.balance)}"
              min="0" step=".01" inputmode="decimal"
              style="padding-left:36px"/>
          </div>
        </div>`).join('')}
    </div>
    <div style="padding:10px 16px">
      <button id="btn-save-debts" class="btn btn-ghost" style="width:100%">Salvar saldos de dívidas</button>
    </div>`;

  document.getElementById('btn-save-debts')?.addEventListener('click', saveDebtBalances);
}

function saveDebtBalances() {
  document.querySelectorAll('.debt-bal-input').forEach(input => {
    const id  = input.dataset.id;
    const val = parseFloat(input.value);
    if (id && !isNaN(val) && val >= 0) {
      debtStateStore.setBalance(id, val);
    }
  });
  const btn  = document.getElementById('btn-save-debts');
  const orig = btn?.textContent;
  if (btn) { btn.textContent = 'Salvo'; setTimeout(() => { btn.textContent = orig; }, 1500); }
  _onChanged?.();
}

function saveParams() {
  const pct    = parseFloat(document.getElementById('param-pct')?.value);
  const fixed  = parseFloat(document.getElementById('param-fixed')?.value);
  const months = parseInt(document.getElementById('param-months')?.value);

  if (isNaN(pct)||pct<0)      { shake('param-pct');    return; }
  if (isNaN(fixed)||fixed<0)  { shake('param-fixed');   return; }
  if (isNaN(months)||months<1) { shake('param-months'); return; }

  paramsStore.set({ pct, fixed, reserveMonths: months });
  const btn  = document.getElementById('btn-save-params');
  const orig = btn?.textContent;
  if (btn) { btn.textContent = 'Salvo'; setTimeout(() => { btn.textContent = orig; }, 1500); }
  _onChanged?.();
}

function resetAll() {
  if (!confirm('Apagar todos os dados? Esta ação é irreversível.')) return;
  clearAll();
  location.reload();
}

function v(id, val)  { const e = document.getElementById(id); if (e) e.value = val ?? ''; }
function shake(id)   { const e = document.getElementById(id); e?.classList.add('err'); e?.focus(); setTimeout(() => e?.classList.remove('err'), 2000); }
function esc(s)      { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
