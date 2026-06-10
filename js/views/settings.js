/**
 * settings.js — editable params + data reset
 */
import { params as paramsStore, diag as diagStore, clearAll } from '../storage.js';
import { monthlyCost, fmt } from '../calc.js';

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
  if (!d) { wrap.innerHTML=''; return; }

  const { fixas, debts, total } = monthlyCost(d);
  const meta = total * d.metaMonths;

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
    </div>`;
}

function saveParams() {
  const pct    = parseFloat(document.getElementById('param-pct')?.value);
  const fixed  = parseFloat(document.getElementById('param-fixed')?.value);
  const months = parseInt(document.getElementById('param-months')?.value);

  if (isNaN(pct)||pct<0)     { shake('param-pct');    return; }
  if (isNaN(fixed)||fixed<0) { shake('param-fixed');   return; }
  if (isNaN(months)||months<1){ shake('param-months'); return; }

  paramsStore.set({ pct, fixed, reserveMonths: months });
  const btn = document.getElementById('btn-save-params');
  const orig = btn.textContent;
  btn.textContent = 'Salvo';
  setTimeout(()=>{ btn.textContent=orig; },1500);
  _onChanged?.();
}

function resetAll() {
  if (!confirm('Apagar todos os dados? Esta ação é irreversível.')) return;
  clearAll();
  location.reload();
}

function v(id, val) { const e=document.getElementById(id); if(e) e.value=val??''; }
function shake(id)  { const e=document.getElementById(id); e?.classList.add('err'); e?.focus(); setTimeout(()=>e?.classList.remove('err'),2000); }
