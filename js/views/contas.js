/**
 * contas.js — aba Contas: CRUD de fixas, variáveis e dívidas
 */
import { diag as diagStore, debtState as debtStateStore } from '../storage.js';
import { fmt, uid, currentDebtTotal } from '../calc.js';

let _onChanged = null;
let _modalType = null;  // 'fixa' | 'variable' | 'debt'
let _editId    = null;

export function initContas(onChanged) {
  _onChanged = onChanged;

  const bg = document.getElementById('modal-conta');
  bg?.addEventListener('click', e => { if (e.target === bg) closeModal(); });
  document.getElementById('btn-conta-cancel')?.addEventListener('click', closeModal);
  document.getElementById('btn-conta-save')?.addEventListener('click', saveModal);
}

export function renderContas() {
  const d     = diagStore.get();
  const fixas = d?.fixas     || [];
  const vars  = d?.variables || [];
  const debts = d?.debts     || [];
  const dsMap = debtStateStore.init(debts);
  const today = new Date().getDate();

  const totalFixas   = fixas.reduce((s, f) => s + Number(f.value), 0);
  const totalVars    = vars.reduce((s, v) => s + Number(v.estimatedValue), 0);
  const totalDebtMin = debts.reduce((s, d) => s + Number(d.installment), 0);
  const totalAll     = totalFixas + totalVars + totalDebtMin;
  const totalDebt    = currentDebtTotal(debts, dsMap);

  // ── Resumo ───────────────────────────────────────────────
  const sumEl = document.getElementById('contas-summary');
  if (sumEl) {
    sumEl.innerHTML = `
    <div class="contas-summary-card">
      <div class="contas-summary-row">
        <span class="contas-summary-lbl">Contas fixas</span>
        <span class="num contas-summary-val">${fmt(totalFixas)}</span>
      </div>
      <div class="contas-summary-row">
        <span class="contas-summary-lbl">Variáveis (estimativa)</span>
        <span class="num contas-summary-val">${fmt(totalVars)}</span>
      </div>
      <div class="contas-summary-row">
        <span class="contas-summary-lbl">Parcelas de dívidas</span>
        <span class="num contas-summary-val">${fmt(totalDebtMin)}</span>
      </div>
      <div class="contas-summary-div"></div>
      <div class="contas-summary-row">
        <span class="contas-summary-lbl fw7">Comprometido total / mês</span>
        <span class="num contas-summary-val fw7 teal">${fmt(totalAll)}</span>
      </div>
      ${totalDebt > 0 ? `
      <div class="contas-summary-row" style="margin-top:2px">
        <span class="contas-summary-lbl">Dívida total acumulada</span>
        <span class="num contas-summary-val warn">${fmt(totalDebt)}</span>
      </div>` : ''}
    </div>`;
  }

  // ── Seções ───────────────────────────────────────────────
  renderFixas(fixas, today);
  renderVariables(vars);
  renderDebts(debts, dsMap);
}

// ── Contas fixas ─────────────────────────────────────────────
function renderFixas(fixas, today) {
  const el = document.getElementById('contas-fixas-section');
  if (!el) return;

  const sorted = [...fixas].sort((a, b) => (Number(a.day) || 0) - (Number(b.day) || 0));
  const total  = fixas.reduce((s, f) => s + Number(f.value), 0);

  el.innerHTML = `
  <div class="sh">Contas fixas <span class="sh-total">${fmt(total)}/mês</span></div>
  <div class="contas-list">
    ${sorted.length
      ? sorted.map(f => {
          const day  = Number(f.day) || 0;
          const past = day > 0 && day < today;
          const now  = day === today;
          const tag  = now ? 'today' : past ? 'past' : 'future';
          const lbl  = now ? 'Vence hoje' : past ? `Venceu dia ${day}` : day > 0 ? `Dia ${day}` : 'Sem dia';
          return `<div class="conta-item">
            <div class="conta-item-body">
              <div class="conta-item-name">${esc(f.name)}</div>
              <div class="conta-due conta-due-${tag}">${lbl}</div>
            </div>
            <div class="conta-item-right">
              <div class="conta-item-val num">${fmt(f.value)}</div>
              <div class="conta-actions">
                <button class="btn-conta-edit btn-icon" data-id="${f.id}" data-type="fixa">${ICON.edit}</button>
                <button class="btn-conta-del btn-icon" data-id="${f.id}" data-type="fixa">${ICON.del}</button>
              </div>
            </div>
          </div>`;
        }).join('')
      : `<div class="contas-empty">Nenhuma conta fixa cadastrada</div>`}
    <button class="add-btn contas-add-btn" data-add="fixa">${ICON.plus} Adicionar conta fixa</button>
  </div>`;

  wireSection(el);
}

// ── Variáveis ─────────────────────────────────────────────────
function renderVariables(vars) {
  const el = document.getElementById('contas-variables-section');
  if (!el) return;

  const total = vars.reduce((s, v) => s + Number(v.estimatedValue), 0);

  el.innerHTML = `
  <div class="sh">Gastos variáveis <span class="sh-total">${fmt(total)} estimado</span></div>
  <div class="contas-hint">Valores que mudam todo mês (mercado, combustível, lazer). Usados como estimativa no planejamento.</div>
  <div class="contas-list">
    ${vars.length
      ? vars.map(v => `<div class="conta-item">
          <div class="conta-item-body">
            <div class="conta-item-name">${esc(v.name)}</div>
            <div class="conta-due conta-due-future">Estimativa</div>
          </div>
          <div class="conta-item-right">
            <div class="conta-item-val num">${fmt(v.estimatedValue)}</div>
            <div class="conta-actions">
              <button class="btn-conta-edit btn-icon" data-id="${v.id}" data-type="variable">${ICON.edit}</button>
              <button class="btn-conta-del btn-icon" data-id="${v.id}" data-type="variable">${ICON.del}</button>
            </div>
          </div>
        </div>`).join('')
      : `<div class="contas-empty">Nenhum gasto variável cadastrado</div>`}
    <button class="add-btn contas-add-btn" data-add="variable">${ICON.plus} Adicionar gasto variável</button>
  </div>`;

  wireSection(el);
}

// ── Dívidas ───────────────────────────────────────────────────
function renderDebts(debts, dsMap) {
  const el = document.getElementById('contas-debts-section');
  if (!el) return;

  const totalMin = debts.reduce((s, d) => s + Number(d.installment), 0);

  el.innerHTML = `
  <div class="sh">Dívidas <span class="sh-total">${fmt(totalMin)}/mês em parcelas</span></div>
  <div class="contas-list">
    ${debts.length
      ? debts.map(debt => {
          const original   = Number(debt.balance);
          const current    = dsMap[debt.id] ?? original;
          const paid       = Math.max(0, original - current);
          const paidPct    = original > 0 ? Math.min(paid / original * 100, 100) : 0;
          const remaining  = current > 0 ? Math.ceil(current / Number(debt.installment)) : 0;
          const hasRate    = debt.interestRate != null && debt.interestRate !== '';
          return `<div class="conta-item conta-item-debt">
            <div class="conta-debt-header">
              <div style="flex:1;min-width:0">
                <div class="conta-item-name">${esc(debt.name)}</div>
                <div class="conta-due conta-due-future" style="margin-top:2px">
                  Parcela ${fmt(debt.installment)}/mês${hasRate ? ` · ${Number(debt.interestRate).toFixed(1)}% a.m.` : ''} · ~${remaining} restante${remaining !== 1 ? 's' : ''}
                </div>
              </div>
              <div style="text-align:right;flex-shrink:0">
                <div class="conta-item-val num warn">${fmt(current)}</div>
                <div style="font-size:.7rem;color:var(--txt3)">de ${fmt(original)}</div>
              </div>
            </div>
            <div class="debt-prog-track">
              <div class="debt-prog-fill" style="width:${paidPct.toFixed(1)}%"></div>
            </div>
            <div class="debt-prog-labels">
              <span class="teal">Pago: ${fmt(paid)}</span>
              <span class="warn">Falta: ${fmt(current)}</span>
            </div>
            <div class="conta-actions" style="margin-top:8px;justify-content:flex-end">
              <button class="btn-conta-edit btn-icon" data-id="${debt.id}" data-type="debt">${ICON.edit}</button>
              <button class="btn-conta-del btn-icon" data-id="${debt.id}" data-type="debt">${ICON.del}</button>
            </div>
          </div>`;
        }).join('')
      : `<div class="contas-empty">Nenhuma dívida cadastrada</div>`}
    <button class="add-btn contas-add-btn" data-add="debt">${ICON.plus} Adicionar dívida</button>
  </div>
  <div class="disclaimer" style="margin-top:4px">
    ${ICON.info} Estimativa com base nos seus dados. Não substitui orientação de um profissional financeiro.
  </div>`;

  wireSection(el);
}

// ── Wire events ───────────────────────────────────────────────
function wireSection(el) {
  el.querySelectorAll('.btn-conta-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const { id, type } = btn.dataset;
      const d = diagStore.get();
      const list = type === 'fixa' ? d?.fixas : type === 'variable' ? d?.variables : d?.debts;
      const item = (list || []).find(x => x.id === id);
      if (item) openModal(type, item);
    });
  });

  el.querySelectorAll('.btn-conta-del').forEach(btn => {
    btn.addEventListener('click', () => {
      const { id, type } = btn.dataset;
      const labels = { fixa: 'conta fixa', variable: 'gasto variável', debt: 'dívida' };
      if (!confirm(`Remover esta ${labels[type]}?`)) return;
      const d = diagStore.get();
      if (!d) return;
      if (type === 'fixa')     d.fixas     = (d.fixas     || []).filter(x => x.id !== id);
      if (type === 'variable') d.variables = (d.variables || []).filter(x => x.id !== id);
      if (type === 'debt')     d.debts     = (d.debts     || []).filter(x => x.id !== id);
      diagStore.set(d);
      renderContas();
      _onChanged?.();
    });
  });

  el.querySelectorAll('.contas-add-btn').forEach(btn => {
    btn.addEventListener('click', () => openModal(btn.dataset.add, null));
  });
}

// ── Modal ─────────────────────────────────────────────────────
function openModal(type, item) {
  _modalType = type;
  _editId    = item?.id || null;

  const titles = {
    fixa:     item ? 'Editar conta fixa'      : 'Nova conta fixa',
    variable: item ? 'Editar gasto variável'  : 'Novo gasto variável',
    debt:     item ? 'Editar dívida'          : 'Nova dívida',
  };
  document.getElementById('modal-conta-title').textContent = titles[type];

  // Toggle field groups
  document.getElementById('conta-fixa-fields').hidden     = type !== 'fixa';
  document.getElementById('conta-var-fields').hidden      = type !== 'variable';
  document.getElementById('conta-debt-fields').hidden     = type !== 'debt';

  v('conta-name', item?.name || '');

  if (type === 'fixa') {
    v('conta-value', item?.value || '');
    v('conta-day',   item?.day   || '');
  } else if (type === 'variable') {
    v('conta-est-value', item?.estimatedValue || '');
  } else if (type === 'debt') {
    v('conta-balance',     item?.balance      || '');
    v('conta-installment', item?.installment  || '');
    v('conta-rate',        item?.interestRate ?? '');
  }

  document.getElementById('modal-conta').classList.add('open');
  setTimeout(() => document.getElementById('conta-name')?.focus(), 80);
}

function closeModal() {
  document.getElementById('modal-conta')?.classList.remove('open');
  _modalType = null;
  _editId    = null;
}

function saveModal() {
  const name = document.getElementById('conta-name')?.value.trim();
  if (!name) { shake('conta-name'); return; }

  const d = { ...(diagStore.get() || {}) };

  if (_modalType === 'fixa') {
    const val = parseFloat(document.getElementById('conta-value')?.value);
    const day = parseInt(document.getElementById('conta-day')?.value) || 0;
    if (!val || val <= 0) { shake('conta-value'); return; }
    const item  = { id: _editId || uid(), name, value: val, day };
    const fixas = d.fixas || [];
    const idx   = fixas.findIndex(x => x.id === item.id);
    if (idx >= 0) fixas[idx] = item; else fixas.push(item);
    d.fixas = fixas;

  } else if (_modalType === 'variable') {
    const val = parseFloat(document.getElementById('conta-est-value')?.value);
    if (!val || val <= 0) { shake('conta-est-value'); return; }
    const item = { id: _editId || uid(), name, estimatedValue: val };
    const vars = d.variables || [];
    const idx  = vars.findIndex(x => x.id === item.id);
    if (idx >= 0) vars[idx] = item; else vars.push(item);
    d.variables = vars;

  } else if (_modalType === 'debt') {
    const balance     = parseFloat(document.getElementById('conta-balance')?.value);
    const installment = parseFloat(document.getElementById('conta-installment')?.value);
    const rateStr     = document.getElementById('conta-rate')?.value.trim();
    const rate        = rateStr !== '' ? parseFloat(rateStr) : null;
    if (!balance || balance <= 0)         { shake('conta-balance');     return; }
    if (!installment || installment <= 0) { shake('conta-installment'); return; }
    const isNew = !_editId;
    const item  = { id: _editId || uid(), name, balance, installment, interestRate: rate };
    const debts = d.debts || [];
    const idx   = debts.findIndex(x => x.id === item.id);
    if (idx >= 0) debts[idx] = item; else debts.push(item);
    d.debts = debts;
    if (isNew) debtStateStore.setBalance(item.id, balance);
  }

  diagStore.set(d);
  closeModal();
  renderContas();
  _onChanged?.();
}

// ── Helpers ───────────────────────────────────────────────────
function v(id, val) { const e = document.getElementById(id); if (e) e.value = val ?? ''; }
function shake(id)  { const e = document.getElementById(id); e?.classList.add('err'); e?.focus(); setTimeout(() => e?.classList.remove('err'), 2000); }
function esc(s)     { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

const ICON = {
  edit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  del:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
};
