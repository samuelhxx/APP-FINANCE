/**
 * settings.js — parâmetros, saldos de dívidas, export/import, guia iOS
 */
import {
  params as paramsStore, diag as diagStore,
  debtState as debtStateStore, clearAll, exportAll, importAll,
} from '../storage.js';
import { monthlyCost, fmt, currentDebtTotal } from '../calc.js';

let _onChanged = null;

export function initSettings(onChanged) {
  _onChanged = onChanged;
  document.getElementById('btn-save-params')?.addEventListener('click', saveParams);
  document.getElementById('btn-reset')?.addEventListener('click', resetAll);
  document.getElementById('btn-export')?.addEventListener('click', doExport);
  document.getElementById('btn-import-file')?.addEventListener('change', doImport);
}

export function renderSettings() {
  const p = paramsStore.get();
  v('param-pct',    p.pct);
  v('param-fixed',  p.fixed);
  v('param-months', p.reserveMonths);

  const d    = diagStore.get();
  const wrap = document.getElementById('diag-summary');
  if (wrap) {
    if (!d) { wrap.innerHTML = ''; }
    else {
      const { fixas, debts, total } = monthlyCost(d);
      const meta  = total * d.metaMonths;
      const dsMap = debtStateStore.init(d.debts || []);
      const debtNow = currentDebtTotal(d.debts || [], dsMap);
      wrap.innerHTML = `
        <div class="s-group" style="margin:0 16px">
          <div class="s-row"><div><div class="s-row-lbl">Custo fixo mensal</div></div><span class="num fw7">${fmt(fixas)}</span></div>
          <div class="s-row"><div><div class="s-row-lbl">Parcelas de dívidas</div></div><span class="num fw7">${fmt(debts)}</span></div>
          <div class="s-row"><div><div class="s-row-lbl">Total compromissos/mês</div></div><span class="num fw7">${fmt(total)}</span></div>
          <div class="s-row"><div><div class="s-row-lbl">Meta de reserva (${d.metaMonths}×)</div></div><span class="num fw7 teal">${fmt(meta)}</span></div>
          ${debtNow > 0 ? `<div class="s-row"><div><div class="s-row-lbl">Dívida total atual</div></div><span class="num fw7 warn">${fmt(debtNow)}</span></div>` : ''}
        </div>`;
    }
  }

  renderDebtBalances(d?.debts || []);
  renderIosGuide();
}

function renderDebtBalances(debts) {
  const wrap = document.getElementById('debt-balances');
  if (!wrap) return;
  if (!debts.length) { wrap.innerHTML = ''; return; }

  const dsMap = debtStateStore.init(debts);
  wrap.innerHTML = `
    <div class="sh">Saldos das dívidas</div>
    <div class="s-group" style="margin:0 16px">
      ${debts.map(d => `
        <div class="s-row" style="align-items:center;gap:8px">
          <div style="flex:1;min-width:0">
            <div class="s-row-lbl">${esc(d.name)}</div>
            <div class="s-row-sub">Parcela: ${fmt(d.installment)}</div>
          </div>
          <div class="pfx" style="max-width:140px">
            <span class="pfx-sym" style="font-size:.78rem">R$</span>
            <input type="number" class="debt-bal-input" data-id="${d.id}"
              value="${(dsMap[d.id] ?? d.balance)}" min="0" step=".01" inputmode="decimal"/>
          </div>
        </div>`).join('')}
    </div>
    <div style="padding:10px 16px">
      <button id="btn-save-debts" class="btn btn-ghost" style="width:100%">Salvar saldos</button>
    </div>`;

  document.getElementById('btn-save-debts')?.addEventListener('click', () => {
    document.querySelectorAll('.debt-bal-input').forEach(inp => {
      const id  = inp.dataset.id;
      const val = parseFloat(inp.value);
      if (id && !isNaN(val) && val >= 0) debtStateStore.setBalance(id, val);
    });
    const btn = document.getElementById('btn-save-debts');
    if (btn) { const t = btn.textContent; btn.textContent = 'Salvo'; setTimeout(() => { btn.textContent = t; }, 1500); }
    _onChanged?.();
  });
}

function renderIosGuide() {
  const wrap = document.getElementById('ios-guide');
  if (!wrap) return;
  // Show only if not already in standalone mode
  if (window.navigator.standalone) { wrap.innerHTML = ''; return; }

  wrap.innerHTML = `
    <div class="sh">Instalar no iPhone</div>
    <div class="s-group" style="margin:0 16px">
      <div style="padding:14px 16px">
        <div style="font-size:.82rem;color:var(--txt2);line-height:1.7">
          Para usar o app offline e evitar perda de dados, instale-o na tela inicial:
        </div>
        <ol style="font-size:.82rem;color:var(--txt2);line-height:2;padding-left:18px;margin-top:8px">
          <li>Abra este link no <strong style="color:var(--txt1)">Safari</strong></li>
          <li>Toque em <strong style="color:var(--txt1)">Compartilhar</strong> (ícone de seta para cima)</li>
          <li>Toque em <strong style="color:var(--txt1)">"Adicionar à Tela de Início"</strong></li>
          <li>Toque em <strong style="color:var(--txt1)">Adicionar</strong></li>
        </ol>
        <div style="margin-top:8px;font-size:.75rem;color:var(--txt3)">
          Atenção: uma vez instalado, use sempre pelo ícone na tela inicial para não perder os dados.
        </div>
      </div>
    </div>`;
}

function saveParams() {
  const pct    = parseFloat(document.getElementById('param-pct')?.value);
  const fixed  = parseFloat(document.getElementById('param-fixed')?.value);
  const months = parseInt(document.getElementById('param-months')?.value);

  if (isNaN(pct)    || pct    < 0) { shake('param-pct');    return; }
  if (isNaN(fixed)  || fixed  < 0) { shake('param-fixed');   return; }
  if (isNaN(months) || months < 1) { shake('param-months'); return; }

  paramsStore.set({ pct, fixed, reserveMonths: months });
  const btn = document.getElementById('btn-save-params');
  if (btn) { const t = btn.textContent; btn.textContent = 'Salvo'; setTimeout(() => { btn.textContent = t; }, 1500); }
  _onChanged?.();
}

function doExport() {
  try {
    const data = exportAll();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    a.href     = url;
    a.download = `controle-financeiro-backup-${date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch(e) {
    alert('Erro ao exportar: ' + e.message);
  }
}

function doImport(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  if (!confirm('Importar backup? Os dados atuais serão substituídos. Esta ação é irreversível.')) {
    e.target.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      importAll(data);
      location.reload();
    } catch(err) {
      alert('Arquivo inválido ou corrompido: ' + err.message);
      e.target.value = '';
    }
  };
  reader.readAsText(file);
}

function resetAll() {
  if (!confirm('Apagar todos os dados? Esta ação é irreversível.')) return;
  clearAll();
  location.reload();
}

function v(id, val)  { const e = document.getElementById(id); if (e) e.value = val ?? ''; }
function shake(id)   { const e = document.getElementById(id); e?.classList.add('err'); e?.focus(); setTimeout(() => e?.classList.remove('err'), 2000); }
function esc(s)      { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
