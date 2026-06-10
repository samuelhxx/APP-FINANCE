/**
 * launch.js — expense logging modal
 */
import { tx as txStore, reserve as resStore } from '../storage.js';
import { uid, fmt } from '../calc.js';

export const CATS = [
  { id:'moradia',    label:'Moradia / Fixas' },
  { id:'mercado',    label:'Mercado / Alimentação' },
  { id:'transporte', label:'Transporte' },
  { id:'saude',      label:'Saúde' },
  { id:'educacao',   label:'Educação' },
  { id:'lazer',      label:'Lazer / Entretenimento' },
  { id:'reserva',    label:'Aporte na Reserva' },
  { id:'outros',     label:'Outros' },
];

export const CAT_ICON = {
  moradia:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  mercado:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`,
  transporte: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`,
  saude:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`,
  educacao:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
  lazer:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>`,
  reserva:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  outros:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>`,
};

let _onSaved = null;

export function initLaunch(onSaved) {
  _onSaved = onSaved;
  const bg = document.getElementById('modal-launch');
  bg?.addEventListener('click', e => { if (e.target === bg) closeLaunch(); });
  document.getElementById('btn-launch-cancel')?.addEventListener('click', closeLaunch);
  document.getElementById('btn-launch-ok')?.addEventListener('click', confirm);
}

export function openLaunch(precat = null) {
  const sel = document.getElementById('launch-cat');
  sel.innerHTML = CATS.map(c => `<option value="${c.id}" ${c.id===precat?'selected':''}>${c.label}</option>`).join('');
  document.getElementById('launch-val').value   = '';
  document.getElementById('launch-desc').value  = '';
  document.getElementById('launch-date').value  = new Date().toISOString().slice(0,10);
  document.getElementById('modal-launch').classList.add('open');
  setTimeout(() => document.getElementById('launch-val')?.focus(), 80);
}

export function closeLaunch() {
  document.getElementById('modal-launch')?.classList.remove('open');
}

function confirm() {
  const val  = parseFloat(document.getElementById('launch-val').value);
  if (!val || val <= 0) { shake('launch-val'); return; }
  const cat  = document.getElementById('launch-cat').value;
  const desc = document.getElementById('launch-desc').value.trim() || CATS.find(c=>c.id===cat)?.label || 'Lançamento';
  const date = document.getElementById('launch-date').value || new Date().toISOString().slice(0,10);

  const t = { id:uid(), cat, value:val, desc, date };
  txStore.add(t);

  if (cat === 'reserva') {
    resStore.adjust(val, `Aporte: ${desc}`, date.slice(0,7));
  }

  closeLaunch();
  _onSaved?.();
}

function shake(id) {
  const el = document.getElementById(id);
  el?.classList.add('err');
  el?.focus();
  setTimeout(() => el?.classList.remove('err'), 1800);
}
