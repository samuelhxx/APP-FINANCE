/**
 * contracts.js — contract CRUD + commission display
 */
import { contracts as store, params as paramsStore } from '../storage.js';
import { commission, fmt, ymLabel, uid } from '../calc.js';
import { refresh } from '../router.js';

let _onChanged = null;

export function initContracts(onChanged) {
  _onChanged = onChanged;
  document.getElementById('btn-new-ct')?.addEventListener('click', () => openModal(null));
  const bg = document.getElementById('modal-ct');
  bg?.addEventListener('click', e => { if (e.target === bg) closeModal(); });
  document.getElementById('btn-ct-cancel')?.addEventListener('click', closeModal);
  document.getElementById('btn-ct-save')?.addEventListener('click', save);
  document.getElementById('ct-status')?.addEventListener('change', toggleDate);
}

export function renderContracts() {
  const list = store.get();
  const p    = paramsStore.get();
  const el   = document.getElementById('contracts-list');

  if (!list.length) {
    el.innerHTML = `<div class="empty">
      <div class="empty-ico">${ICONS.doc}</div>
      <div class="empty-title">Nenhum contrato cadastrado</div>
      <div class="empty-sub">Adicione uma obra para calcular a comissão e registrar a renda.</div>
    </div>`; return;
  }

  const closed  = list.filter(c => c.status==='closed').sort((a,b)=>(b.startDate||'').localeCompare(a.startDate||''));
  const pending = list.filter(c => c.status==='pending');

  let html = '';
  if (closed.length)  { html += `<div class="sh">Contratos fechados</div>`;  html += closed.map(c=>card(c,p)).join(''); }
  if (pending.length) { html += `<div class="sh">Em negociação</div>`;        html += pending.map(c=>card(c,p)).join(''); }

  el.innerHTML = html;

  el.querySelectorAll('.btn-ct-edit').forEach(b => b.addEventListener('click', () => openModal(list.find(c=>c.id===b.dataset.id))));
  el.querySelectorAll('.btn-ct-del') .forEach(b => b.addEventListener('click', () => { if(confirm('Remover contrato?')) { store.remove(b.dataset.id); renderContracts(); _onChanged?.(); } }));
}

function card(c, p) {
  const com  = commission(c, p);
  const isCl = c.status === 'closed';
  const mon  = c.startDate ? ymLabel(c.startDate.slice(0,7), {month:'short',year:'numeric'}) : '—';
  return `<div class="contract-card">
    <div class="cc-header">
      <div>
        <div class="cc-name">${esc(c.name)}</div>
        <div class="cc-meta">${isCl ? `Início: ${mon}` : 'Aguardando fechamento'}</div>
      </div>
      <div style="text-align:right">
        <div class="cc-val num">${fmt(c.value)}</div>
        <div style="margin-top:4px">
          <span class="badge ${isCl?'bdg-teal':'bdg-neutral'}">
            <span class="bdg-dot"></span>
            ${isCl?'Fechado':'Em negociação'}
          </span>
        </div>
      </div>
    </div>
    <div class="cc-commission">
      <div>
        <div class="cc-comm-lbl">
          Comissão ${c.override!=null && c.override!=='' ? '(personalizada)' : `(${p.pct}% + R$${p.fixed.toLocaleString('pt-BR')})`}
        </div>
        ${!isCl?`<div class="cc-pending">Não conta como renda até fechar</div>`:''}
      </div>
      <div class="cc-comm-val num">${fmt(com)}</div>
    </div>
    <div style="display:flex;gap:8px;margin-top:12px">
      <button class="btn btn-ghost btn-sm btn-ct-edit" data-id="${c.id}" style="flex:1">Editar</button>
      <button class="btn btn-danger btn-sm btn-ct-del"  data-id="${c.id}">Remover</button>
    </div>
  </div>`;
}

// ── Modal ──────────────────────────────────────────────────────
function openModal(c) {
  document.getElementById('ct-modal-title').textContent = c ? 'Editar contrato' : 'Novo contrato';
  v('ct-id',       c?.id       || uid());
  v('ct-name',     c?.name     || '');
  v('ct-value',    c?.value    || '');
  v('ct-status',   c?.status   || 'pending');
  v('ct-date',     c?.startDate || '');
  v('ct-override', c?.override != null ? c.override : '');
  toggleDate();
  document.getElementById('modal-ct').classList.add('open');
  document.getElementById('ct-name')?.focus();
}

function closeModal() { document.getElementById('modal-ct')?.classList.remove('open'); }

function toggleDate() {
  const wrap = document.getElementById('ct-date-wrap');
  if (wrap) wrap.hidden = document.getElementById('ct-status').value !== 'closed';
}

function save() {
  const name  = document.getElementById('ct-name')?.value.trim();
  const val   = parseFloat(document.getElementById('ct-value')?.value);
  if (!name) { shake('ct-name'); return; }
  if (!val||val<=0) { shake('ct-value'); return; }
  const status = document.getElementById('ct-status').value;
  const date   = document.getElementById('ct-date').value;
  if (status==='closed'&&!date) { shake('ct-date'); return; }

  store.upsert({
    id:        document.getElementById('ct-id').value,
    name, value: val, status,
    startDate: status==='closed' ? date : null,
    override:  document.getElementById('ct-override').value !== '' ? parseFloat(document.getElementById('ct-override').value) : null,
  });
  closeModal();
  renderContracts();
  _onChanged?.();
}

// ── Util ──────────────────────────────────────────────────────
function v(id, val) { const e=document.getElementById(id); if(e) e.value=val??''; }
function shake(id) { const e=document.getElementById(id); e?.classList.add('err'); e?.focus(); setTimeout(()=>e?.classList.remove('err'),2000); }
function esc(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

const ICONS = {
  doc: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
};
