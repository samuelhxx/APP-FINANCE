/**
 * contracts.js — módulo de contratos/obras
 */
import { getContracts, upsertContract, removeContract, getParams } from '../storage.js';
import { calcComissao, fmtBRL, ymLabel, uid } from '../calc.js';

let onChanged = null;

export function initContracts(changedCb) {
  onChanged = changedCb;
  document.getElementById('btn-new-contract')
    ?.addEventListener('click', () => openContractModal(null));
  document.getElementById('contract-modal-backdrop')
    ?.addEventListener('click', e => { if (e.target === e.currentTarget) closeContractModal(); });
  document.getElementById('btn-contract-cancel')
    ?.addEventListener('click', closeContractModal);
  document.getElementById('btn-contract-save')
    ?.addEventListener('click', saveContract);
}

export function renderContracts() {
  const contracts = getContracts();
  const params    = getParams();
  const list      = document.getElementById('contracts-list');

  if (contracts.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
        </div>
        <div class="empty-title">Nenhum contrato cadastrado</div>
        <div class="empty-sub">Adicione uma obra para calcular a comissão e registrar a renda.</div>
      </div>`;
    return;
  }

  // separar negociação / fechados
  const emNeg   = contracts.filter(c => c.status === 'negociacao');
  const fechados = contracts.filter(c => c.status === 'fechado').sort((a,b) => (b.data_inicio||'').localeCompare(a.data_inicio||''));

  let html = '';

  if (fechados.length) {
    html += `<div class="section-head">Contratos fechados</div>`;
    html += fechados.map(c => contractCard(c, params)).join('');
  }

  if (emNeg.length) {
    html += `<div class="section-head">Em negociação</div>`;
    html += emNeg.map(c => contractCard(c, params)).join('');
  }

  list.innerHTML = html;

  // eventos de editar / remover
  list.querySelectorAll('.btn-edit-contract').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      openContractModal(contracts.find(c => c.id === id));
    });
  });
  list.querySelectorAll('.btn-del-contract').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('Remover este contrato?')) {
        removeContract(btn.dataset.id);
        renderContracts();
        if (onChanged) onChanged();
      }
    });
  });
}

function contractCard(c, params) {
  const comissao  = calcComissao(c, params);
  const isFechado = c.status === 'fechado';
  const mesLabel  = c.data_inicio ? ymLabel(c.data_inicio.slice(0,7), { month: 'short', year: 'numeric' }) : '—';

  return `
    <div class="contract-card">
      <div class="contract-header">
        <div>
          <div class="contract-name">${escHtml(c.nome)}</div>
          <div class="contract-meta">${isFechado ? `Início: ${mesLabel}` : 'Aguardando fechamento'}</div>
        </div>
        <div style="text-align:right">
          <div class="contract-value num">${fmtBRL(c.valor)}</div>
          <div style="margin-top:4px">
            <span class="badge ${isFechado ? 'badge-teal' : 'badge-neutral'}">
              <span class="badge-dot"></span>
              ${isFechado ? 'Fechado' : 'Em negociação'}
            </span>
          </div>
        </div>
      </div>
      <div class="contract-commission">
        <div>
          <div class="commission-label">Comissão ${c.comissao_override ? '(personalizada)' : `(${params.commission_pct}% + R$ ${params.commission_fixed.toLocaleString('pt-BR')})`}</div>
          ${!isFechado ? `<div class="contract-pending-note">Não conta como renda até fechar</div>` : ''}
        </div>
        <div class="commission-value num">${fmtBRL(comissao)}</div>
      </div>
      <div style="display:flex;gap:8px;margin-top:12px">
        <button class="btn btn-ghost btn-sm btn-edit-contract" data-id="${c.id}" style="flex:1">Editar</button>
        <button class="btn btn-danger-ghost btn-sm btn-del-contract" data-id="${c.id}">Remover</button>
      </div>
    </div>`;
}

// ── Modal ──────────────────────────────────────────────────────
function openContractModal(contract) {
  const title = document.getElementById('contract-modal-title');
  title.textContent = contract ? 'Editar contrato' : 'Novo contrato';

  const f = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };
  f('contract-id',       contract?.id || uid());
  f('contract-nome',     contract?.nome || '');
  f('contract-valor',    contract?.valor || '');
  f('contract-status',   contract?.status || 'negociacao');
  f('contract-data',     contract?.data_inicio || '');
  f('contract-override', contract?.comissao_override ?? '');

  toggleDataField();
  document.getElementById('contract-modal-backdrop').classList.add('open');
  document.getElementById('contract-nome')?.focus();
}

export function closeContractModal() {
  document.getElementById('contract-modal-backdrop')?.classList.remove('open');
}

function toggleDataField() {
  const status = document.getElementById('contract-status')?.value;
  const wrap   = document.getElementById('contract-data-wrap');
  if (wrap) wrap.style.display = status === 'fechado' ? '' : 'none';
}

// hook status change inside modal
document.addEventListener('change', e => {
  if (e.target.id === 'contract-status') toggleDataField();
});

function saveContract() {
  const nome  = document.getElementById('contract-nome')?.value.trim();
  const valor = parseFloat(document.getElementById('contract-valor')?.value);
  if (!nome) { markError('contract-nome'); return; }
  if (!valor || valor <= 0) { markError('contract-valor'); return; }

  const status  = document.getElementById('contract-status').value;
  const dataEl  = document.getElementById('contract-data').value;
  if (status === 'fechado' && !dataEl) { markError('contract-data'); return; }

  const override = document.getElementById('contract-override')?.value;

  const contract = {
    id:                 document.getElementById('contract-id').value,
    nome, valor, status,
    data_inicio:        status === 'fechado' ? dataEl : null,
    comissao_override:  override !== '' ? parseFloat(override) : null,
  };

  upsertContract(contract);
  closeContractModal();
  renderContracts();
  if (onChanged) onChanged();
}

function markError(id) {
  const el = document.getElementById(id);
  el?.classList.add('error');
  el?.focus();
  setTimeout(() => el?.classList.remove('error'), 2000);
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
