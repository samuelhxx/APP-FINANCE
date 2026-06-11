/**
 * router.js — view switching + bottom nav state
 */

const APP_VIEWS = ['reserve','contracts','contas','month','settings'];
let _current = null;
const _listeners = {};

export function onNavigate(view, fn) {
  _listeners[view] = fn;
}

export function navigate(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const el = document.getElementById(`view-${view}`);
  if (el) el.classList.add('active');
  _current = view;

  const nav = document.getElementById('bottom-nav');
  nav.classList.toggle('visible', APP_VIEWS.includes(view));

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });

  if (_listeners[view]) _listeners[view]();
}

export function current() { return _current; }

export function refresh() {
  if (_current && _listeners[_current]) _listeners[_current]();
}
