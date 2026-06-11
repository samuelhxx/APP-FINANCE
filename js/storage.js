/**
 * storage.js — localStorage CRUD + schema migration
 * Schema version: 4 (v3→v4 additive, no data wipe)
 */

export const SCHEMA_V = 4;

const KEYS = {
  VER:        'fc_ver',
  DIAG:       'fc_diag',
  PARAMS:     'fc_params',
  CONTRACTS:  'fc_contracts',
  RESERVE:    'fc_reserve',
  GOALS:      'fc_goals',
  TX:         (ym) => `fc_tx_${ym}`,
  DEBT_STATE: 'fc_debts_state',
  SNAP:       (ym) => `fc_snap_${ym}`,
};

// ── Core ──────────────────────────────────────────────────────
export function get(key, def = null) {
  try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : def; }
  catch { return def; }
}
export function set(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch(e) { console.error(e); }
}
export function del(key) { localStorage.removeItem(key); }
export function clearAll() {
  Object.keys(localStorage).filter(k => k.startsWith('fc_')).forEach(k => localStorage.removeItem(k));
}

// ── Migration ─────────────────────────────────────────────────
export function migrate() {
  const v = get(KEYS.VER, 0);
  if (v < 3) {
    // breaking change — wipe old data
    clearAll();
    set(KEYS.VER, SCHEMA_V);
    return;
  }
  // v3→v4: additive, no wipe needed
  if (v < SCHEMA_V) {
    set(KEYS.VER, SCHEMA_V);
  }
}

// ── Default params ────────────────────────────────────────────
const DEF_PARAMS = { pct: 5, fixed: 2000, reserveMonths: 6 };

export const params = {
  get: ()  => ({ ...DEF_PARAMS, ...get(KEYS.PARAMS, {}) }),
  set: (p) => set(KEYS.PARAMS, p),
};

// ── Diagnosis ─────────────────────────────────────────────────
export const diag = {
  get: ()  => get(KEYS.DIAG, null),
  set: (d) => set(KEYS.DIAG, d),
};

// ── Contracts ─────────────────────────────────────────────────
export const contracts = {
  get: ()    => get(KEYS.CONTRACTS, []),
  set: (arr) => set(KEYS.CONTRACTS, arr),
  upsert(c) {
    const list = this.get();
    const i = list.findIndex(x => x.id === c.id);
    if (i >= 0) list[i] = c; else list.push(c);
    this.set(list);
  },
  remove(id) { this.set(this.get().filter(c => c.id !== id)); },
};

// ── Reserve ───────────────────────────────────────────────────
const DEF_RESERVE = { saldo: 0, log: [] };

export const reserve = {
  get: ()    => get(KEYS.RESERVE, DEF_RESERVE),
  set: (r)   => set(KEYS.RESERVE, r),
  setSaldo(n) {
    const r = this.get();
    r.saldo = Math.max(0, n);
    this.set(r);
  },
  adjust(delta, label, ym) {
    const r = this.get();
    r.saldo = Math.max(0, r.saldo + delta);
    r.log.push({ ym, delta, label, ts: Date.now() });
    this.set(r);
    return r.saldo;
  },
};

// ── Debt State ────────────────────────────────────────────────
// Tracks current balance of each debt by its id
export const debtState = {
  get: () => get(KEYS.DEBT_STATE, {}),
  set: (obj) => set(KEYS.DEBT_STATE, obj),

  // Lazily initialise balances from diagnosis — only adds debts not yet tracked
  init(debts) {
    const current = this.get();
    let changed = false;
    debts.forEach(d => {
      if (!(d.id in current)) {
        current[d.id] = Number(d.balance) || 0;
        changed = true;
      }
    });
    if (changed) this.set(current);
    return current;
  },

  setBalance(debtId, balance) {
    const obj = this.get();
    obj[debtId] = Math.max(0, Number(balance));
    this.set(obj);
  },

  // Reduce each debt by its minimum installment (called at month close)
  payInstallments(debts) {
    const obj = this.get();
    debts.forEach(d => {
      if (d.id in obj) {
        obj[d.id] = Math.max(0, obj[d.id] - Number(d.installment));
      }
    });
    this.set(obj);
    return obj;
  },
};

// ── Monthly Snapshots ─────────────────────────────────────────
// Saved at month-end: income, spending, reserve balance, debt state
export const snapshots = {
  get: (ym)  => get(KEYS.SNAP(ym), null),
  set: (ym, data) => set(KEYS.SNAP(ym), { ...data, ym }),
  getAll() {
    return Object.keys(localStorage)
      .filter(k => k.startsWith('fc_snap_'))
      .map(k => {
        try { return JSON.parse(localStorage.getItem(k)); } catch { return null; }
      })
      .filter(Boolean)
      .sort((a, b) => a.ym.localeCompare(b.ym));
  },
};

// ── Transactions ──────────────────────────────────────────────
export const tx = {
  get: (ym)  => get(KEYS.TX(ym), []),
  set: (ym, arr) => set(KEYS.TX(ym), arr),
  add(t) {
    const ym = t.date.slice(0, 7);
    const list = this.get(ym);
    list.push(t);
    this.set(ym, list);
  },
  remove(id, ym) {
    this.set(ym, this.get(ym).filter(t => String(t.id) !== String(id)));
  },
};
