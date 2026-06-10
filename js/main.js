/**
 * main.js — app entry point: init + wire everything together
 */
import { migrate, diag as diagStore } from './storage.js';
import { navigate, onNavigate, refresh } from './router.js';
import { initDiagnosis, startDiagnosis } from './views/diagnosis.js';
import { renderReserve } from './views/reserve.js';
import { initLaunch, openLaunch, closeLaunch } from './views/launch.js';
import { initContracts, renderContracts } from './views/contracts.js';
import { initMonth, renderMonth } from './views/month.js';
import { initSettings, renderSettings } from './views/settings.js';

// ── Register view renderers ───────────────────────────────────
onNavigate('reserve',   renderReserve);
onNavigate('contracts', renderContracts);
onNavigate('month',     renderMonth);
onNavigate('settings',  renderSettings);

// ── Wire sub-modules ──────────────────────────────────────────
initDiagnosis();
initLaunch(() => refresh());
initContracts(() => refresh());
initMonth(() => refresh());
initSettings(() => refresh());

// ── Bottom nav ────────────────────────────────────────────────
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.view;
    if (target === '_launch') { openLaunch(); return; }
    navigate(target);
  });
});

// ── Welcome CTA ───────────────────────────────────────────────
document.getElementById('btn-welcome')?.addEventListener('click', () => {
  navigate('diagnosis');
  startDiagnosis();
});

// ── Boot ──────────────────────────────────────────────────────
migrate();

setTimeout(() => {
  document.getElementById('splash')?.classList.add('splash-out');
  const hasDiag = !!diagStore.get();
  navigate(hasDiag ? 'reserve' : 'welcome');
}, 750);
