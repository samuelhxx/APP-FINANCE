/**
 * contracts.js — contract CRUD + commission + partial receipt tracking
 */
import { contracts as store, params as paramsStore } from '../storage.js';
import { commission, totalReceived, toReceive, fmt, ymLabel, uid } from '../calc.js';
import { refresh } from '../router.js';

let _onChanged = null;

export function initContracts(onChanged) {
  _onChanged = onChanged;

  // contract modal
  document.getElementById('btn-new-ct')?.addEventListener('click', () => openModal(null));
  const bg = document.getElementById('modal-ct');
  bg?.addEventListener('click', e => { if (e.target === bg) closeModal(); });
  document.getElementById('btn-ct-cancel')?.addEventListener('click', closeModal);
  document.getElementById('btn-ct-save')?.addEventListener('click', save);
  document.getElementById('ct-status')?.addEventListener('change', toggleDate);

  // receipt modal
  const rbg = document.getElementById('modal-rcpt');
  rbg?.addEventListener('click', e => { if (e.target === rbg) closeRcpt(); });
  document.getElementById('btn-rcpt-cancel')?.addEventListener('click', closeRcpt);
  document.getElementById('btn-rcpt-save')?.addEventListener('click', saveRcpt);
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

  el.querySelectorAll('.btn-ct-edit').forEach(b =>
    b.addEventListener('click', () => openModal(list.find(c=>c.id===b.dataset.id))));
  el.querySelectorAll('.btn-ct-del').forEach(b =>
    b.addEventListener('click', () => {
      if (confirm('Remover contrato?')) { store.remove(b.dataset.id); renderContracts(); _onChanged?.(); }
    }));
  el.querySelectorAll('.btn-rcpt-add').forEach(b =>
    b.addEventListener('click', () => openRcpt(b.dataset.id)));
}

// ── Card ──────────────────────────────────────────────────────
function card(c, p) {
  const com     = commission(c, p);
  const recvd   = totalReceived(c);
  const pending = toReceive(c, p);
  const pct     = com > 0 ? Math.min(recvd / com * 100, 100) : 0;
  const isCl    = c.status === 'closed';
  const mon     = c.startDate ? ymLabel(c.startDate.slice(0,7), {month:'short',year:'numeric'}) : '—';
  const rcptStatus = pct >= 100 ? 'teal' : pct > 0 ? 'warn' : 'neutral';

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

    ${isCl ? `
    <!-- comissão + recebimento -->
    <div class="cc-commission" style="flex-direction:column;gap:10px;align-items:stretch">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div class="cc-comm-lbl">
          Comissão total ${c.override!=null && c.override!=='' ? '(personalizada)' : `(${p.pct}% + R$${p.fixed.toLocaleString('pt-BR')})`}
        </div>
        <div class="cc-comm-val num">${fmt(com)}</div>
      </div>

      <!-- progress bar -->
      <div class="rcpt-track">
        <div class="rcpt-fill rcpt-${rcptStatus}" style="width:${pct.toFixed(1)}%"></div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div style="background:var(--bg-raise);border-radius:var(--r-sm);padding:8px 10px">
          <div class="cc-comm-lbl" style="margin-bottom:3px">Recebido</div>
          <div class="num" style="font-size:.95rem;font-weight:700;color:var(--teal)">${fmt(recvd)}</div>
        </div>
        <div style="background:var(--bg-raise);border-radius:var(--r-sm);padding:8px 10px">
          <div class="cc-comm-lbl" style="margin-bottom:3px">A receber</div>
          <div class="num" style="font-size:.95rem;font-weight:700;color:${pending > 0 ? 'var(--warn)' : 'var(--teal)'}">
            ${fmt(pending)}
          </div>
        </div>
      </div>
    </div>` : `
    <div class="cc-commission">
      <div class="cc-comm-lbl">Não conta como renda até fechar</div>
      <div class="cc-comm-val num">${fmt(com)}</div>
    </div>`}

    <div style="display:flex;gap:8px;margin-top:12px">
      <button class="btn btn-ghost btn-sm btn-ct-edit" data-id="${c.id}" style="flex:1">Editar</button>
      ${isCl ? `<button class="btn btn-ghost btn-sm btn-rcpt-add" data-id="${c.id}" style="flex:1">+ Recebimento</button>` : ''}
      <button class="btn btn-danger btn-sm btn-ct-del" data-id="${c.id}">Remover</button>
    </div>

    ${isCl && (c.receipts||[]).length > 0 ? `
    <div style="margin-top:10px;border-top:1px solid var(--border);padding-top:10px">
      <div class="cc-comm-lbl" style="margin-bottom:6px">Recebimentos registrados</div>
      ${(c.receipts||[]).slice().reverse().map(r => `
        <div style="display:flex;justify-content:space-between;align-items:center;
                    padding:5px 0;border-bottom:1px solid var(--border);font-size:.8rem">
          <span style="color:var(--txt2)">${fmtDate(r.date)}${r.note ? ' · ' + esc(r.note) : ''}</span>
          <div style="display:flex;align-items:center;gap:8px">
            <span class="num" style="font-weight:700;color:var(--teal)">${fmt(r.value)}</span>
            <button class="tx-del btn-rcpt-del" data-cid="${c.id}" data-rid="${r.id}" title="Remover recebimento">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
            </button>
          </div>
        </div>`).join('')}
    </div>` : ''}
  </div>`;
}

// ── Contract modal ─────────────────────────────────────────────
function openModal(c) {
  document.getElementById('ct-modal-title').textContent = c ? 'Editar contrato' : 'Novo contrato';
  v('ct-id',       c?.id        || uid());
  v('ct-name',     c?.name      || '');
  v('ct-value',    c?.value     || '');
  v('ct-status',   c?.status    || 'pending');
  v('ct-date',     c?.startDate || '');
  v('ct-override', c?.override  != null ? c.override : '');
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
  const name = document.getElementById('ct-name')?.value.trim();
  const val  = parseFloat(document.getElementById('ct-value')?.value);
  if (!name)       { shake('ct-name');  return; }
  if (!val||val<=0){ shake('ct-value'); return; }
  const status = document.getElementById('ct-status').value;
  const date   = document.getElementById('ct-date').value;
  if (status==='closed'&&!date) { shake('ct-date'); return; }

  const existing = store.get().find(c => c.id === document.getElementById('ct-id').value);
  store.upsert({
    id:        document.getElementById('ct-id').value,
    name, value: val, status,
    startDate: status==='closed' ? date : null,
    override:  document.getElementById('ct-override').value !== ''
               ? parseFloat(document.getElementById('ct-override').value) : null,
    receipts:  existing?.receipts || [],  // preserve existing receipts
  });
  closeModal();
  renderContracts();
  _onChanged?.();
}

// ── Receipt modal ──────────────────────────────────────────────
let _rcptContractId = null;

function openRcpt(contractId) {
  _rcptContractId = contractId;
  const ct   = store.get().find(c => c.id === contractId);
  const p    = paramsStore.get();
  const com  = commission(ct, p);
  const recvd = totalReceived(ct);
  const remaining = Math.max(0, com - recvd);

  document.getElementById('rcpt-contract-name').textContent = ct?.name || '';
  document.getElementById('rcpt-remaining').textContent = `A receber: ${fmt(remaining)}`;
  v('rcpt-val',  '');
  v('rcpt-note', '');
  v('rcpt-date', new Date().toISOString().slice(0,10));
  document.getElementById('modal-rcpt').classList.add('open');
  setTimeout(() => document.getElementById('rcpt-val')?.focus(), 80);
}

function closeRcpt() {
  document.getElementById('modal-rcpt')?.classList.remove('open');
  _rcptContractId = null;
}

function saveRcpt() {
  const val = parseFloat(document.getElementById('rcpt-val').value);
  if (!val || val <= 0) { shake('rcpt-val'); return; }
  const date = document.getElementById('rcpt-date').value || new Date().toISOString().slice(0,10);
  const note = document.getElementById('rcpt-note').value.trim();

  const ct   = store.get().find(c => c.id === _rcptContractId);
  if (!ct) return;
  const receipts = ct.receipts || [];
  receipts.push({ id: uid(), value: val, date, note });
  store.upsert({ ...ct, receipts });

  closeRcpt();
  renderContracts();
  _onChanged?.();
}

// wire up dynamic delete buttons via event delegation
document.addEventListener('click', e => {
  const btn = e.target.closest('.btn-rcpt-del');
  if (!btn) return;
  const { cid, rid } = btn.dataset;
  const ct = store.get().find(c => c.id === cid);
  if (!ct) return;
  store.upsert({ ...ct, receipts: (ct.receipts||[]).filter(r => r.id !== rid) });
  renderContracts();
  refresh();
});

// ── Util ──────────────────────────────────────────────────────
function v(id, val) { const e=document.getElementById(id); if(e) e.value=val??''; }
function shake(id)  { const e=document.getElementById(id); e?.classList.add('err'); e?.focus(); setTimeout(()=>e?.classList.remove('err'),2000); }
function esc(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function fmtDate(d) {
  if (!d) return '';
  return new Date(d+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short'});
}

const ICONS = {
  doc: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
};
