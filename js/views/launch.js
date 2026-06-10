/**
 * launch.js — modal de lançamento de gastos
 */
import { addTx, updateReserve } from '../storage.js';
import { uid, ymNow, fmtBRL } from '../calc.js';

const CATEGORIAS = [
  { id: 'mercado',    label: 'Mercado / Alimentação' },
  { id: 'moradia',    label: 'Moradia (fixas)' },
  { id: 'transporte', label: 'Transporte' },
  { id: 'saude',      label: 'Saúde' },
  { id: 'educacao',   label: 'Educação' },
  { id: 'lazer',      label: 'Lazer / Entretenimento' },
  { id: 'reserva',    label: 'Transferência p/ Reserva' },
  { id: 'outros',     label: 'Outros' },
];

export const CAT_ICONS = {
  mercado:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`,
  moradia:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  transporte: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`,
  saude:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`,
  educacao:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
  lazer:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>`,
  reserva:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  outros:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>`,
};

let onSaved = null;

export function initLaunch(savedCb) {
  onSaved = savedCb;
  document.getElementById('modal-launch-backdrop')
    ?.addEventListener('click', e => { if (e.target === e.currentTarget) closeLaunch(); });
  document.getElementById('btn-launch-cancel')
    ?.addEventListener('click', closeLaunch);
  document.getElementById('btn-launch-confirm')
    ?.addEventListener('click', confirmLaunch);
}

export function openLaunchModal(preselect = null) {
  const opts = CATEGORIAS.map(c =>
    `<option value="${c.id}" ${c.id === preselect ? 'selected' : ''}>${c.label}</option>`
  ).join('');

  document.getElementById('launch-cat').innerHTML = opts;
  document.getElementById('launch-valor').value   = '';
  document.getElementById('launch-desc').value    = '';
  document.getElementById('launch-data').value    = new Date().toISOString().slice(0,10);

  document.getElementById('modal-launch-backdrop').classList.add('open');
  setTimeout(() => document.getElementById('launch-valor')?.focus(), 80);
}

export function closeLaunch() {
  document.getElementById('modal-launch-backdrop')?.classList.remove('open');
}

function confirmLaunch() {
  const valor = parseFloat(document.getElementById('launch-valor').value);
  if (!valor || valor <= 0) {
    document.getElementById('launch-valor').classList.add('error');
    setTimeout(() => document.getElementById('launch-valor').classList.remove('error'), 1500);
    return;
  }
  const cat  = document.getElementById('launch-cat').value;
  const desc = document.getElementById('launch-desc').value.trim() || CATEGORIAS.find(c=>c.id===cat)?.label || 'Lançamento';
  const data = document.getElementById('launch-data').value || new Date().toISOString().slice(0,10);

  const tx = { id: uid(), categoria: cat, valor, descricao: desc, data };
  addTx(tx);

  // movimentação na reserva
  if (cat === 'reserva') {
    updateReserve(valor, `Aporte manual: ${desc}`, data.slice(0,7));
  }

  closeLaunch();
  if (onSaved) onSaved();
}
