/**
 * app.js — roteador principal + init
 */
import { migrate, getDiagnosis } from './storage.js';
import { initDiagnosis, startDiagnosis } from './views/diagnosis.js';
import { renderReserve } from './views/reserve.js';
import { initLaunch, openLaunchModal, closeLaunch } from './views/launch.js';
import { initContracts, renderContracts } from './views/contracts.js';
import { initMonth, renderMonth } from './views/month.js';
import { initSettings, renderSettings } from './views/settings.js';

// ── State ─────────────────────────────────────────────────────
let currentView = null;

// ── Router ────────────────────────────────────────────────────
export function navigate(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`view-${id}`)?.classList.add('active');
  currentView = id;

  const appViews = ['reserve', 'contracts', 'month', 'settings'];
  document.getElementById('bottom-nav').classList.toggle('visible', appViews.includes(id));

  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.view === id);
  });

  // render on navigate
  if (id === 'reserve')   renderReserve();
  if (id === 'contracts') renderContracts();
  if (id === 'month')     renderMonth();
  if (id === 'settings')  renderSettings();
}

// shared refresh (called after data mutations)
function refresh() {
  if (currentView === 'reserve')   renderReserve();
  if (currentView === 'month')     renderMonth();
  if (currentView === 'contracts') renderContracts();
  if (currentView === 'settings')  renderSettings();
}

// ── Init ──────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  migrate();

  // sub-module init
  initDiagnosis((diagnosis) => {
    // diagnosis complete — go to reserve dashboard
    navigate('reserve');
  });

  initLaunch(() => refresh());
  initContracts(() => refresh());
  initMonth(() => refresh());
  initSettings(() => refresh());

  // bottom nav — intercept '_launch' special tab
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.view;
      if (target === '_launch') { openLaunchModal(); return; }
      navigate(target);
    });
  });

  // splash → route
  setTimeout(() => {
    document.getElementById('splash').classList.add('out');
    const hasDiag = !!getDiagnosis();
    navigate(hasDiag ? 'reserve' : 'welcome');
  }, 700);
});

// expose navigate globally (used by settings gear shortcut)
window._navigate = navigate;

// welcome CTA
document.addEventListener('click', e => {
  if (e.target.id === 'btn-welcome-start') {
    navigate('diagnosis');
    startDiagnosis();
  }
});
