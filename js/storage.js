/**
 * storage.js — localStorage CRUD + schema migration
 * Schema version: 2 (renda variável + contratos)
 */

const SCHEMA_VERSION = 2;

const KEYS = {
  VERSION:   'fc_schema_version',
  DIAGNOSIS: 'fc_diagnosis',
  PARAMS:    'fc_params',
  CONTRACTS: 'fc_contracts',
  TX:        (ym) => `fc_tx_${ym}`,
  RESERVE:   'fc_reserve',       // { saldo: number, historico: [{ym, delta, motivo}] }
  GOALS:     'fc_goals',
};

function get(key, def = null) {
  try {
    const v = localStorage.getItem(key);
    return v !== null ? JSON.parse(v) : def;
  } catch { return def; }
}

function set(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { console.error('storage.set', e); }
}

function remove(key) { localStorage.removeItem(key); }

function clearAll() {
  Object.keys(localStorage)
    .filter(k => k.startsWith('fc_'))
    .forEach(k => localStorage.removeItem(k));
}

/** Run once on app init — migrate old schemas if needed. */
function migrate() {
  const v = get(KEYS.VERSION, 0);
  if (v === SCHEMA_VERSION) return;

  if (v < 2) {
    // v1 → v2: remove old keys, start fresh (breaking change — variable income model)
    Object.keys(localStorage).filter(k => k.startsWith('fc_')).forEach(k => localStorage.removeItem(k));
  }

  set(KEYS.VERSION, SCHEMA_VERSION);
}

// ── Default params ────────────────────────────────────────────
const DEFAULT_PARAMS = {
  commission_pct:   5,      // % do valor do contrato
  commission_fixed: 2000,   // R$ fixo por contrato fechado
  reserve_months:   6,      // meta de meses de reserva
};

function getParams() {
  return { ...DEFAULT_PARAMS, ...get(KEYS.PARAMS, {}) };
}

function setParams(p) { set(KEYS.PARAMS, p); }

// ── Diagnosis ─────────────────────────────────────────────────
function getDiagnosis() { return get(KEYS.DIAGNOSIS, null); }
function setDiagnosis(d) { set(KEYS.DIAGNOSIS, d); }

// ── Contracts ─────────────────────────────────────────────────
function getContracts() { return get(KEYS.CONTRACTS, []); }
function setContracts(arr) { set(KEYS.CONTRACTS, arr); }

function upsertContract(contract) {
  const list = getContracts();
  const idx  = list.findIndex(c => c.id === contract.id);
  if (idx >= 0) list[idx] = contract;
  else list.push(contract);
  setContracts(list);
}

function removeContract(id) {
  setContracts(getContracts().filter(c => c.id !== id));
}

// ── Transactions ──────────────────────────────────────────────
function getTx(ym) { return get(KEYS.TX(ym), []); }

function addTx(tx) {
  const ym  = tx.data.slice(0, 7);
  const txs = getTx(ym);
  txs.push(tx);
  set(KEYS.TX(ym), txs);
}

function removeTx(id, ym) {
  const txs = getTx(ym).filter(t => String(t.id) !== String(id));
  set(KEYS.TX(ym), txs);
}

// ── Reserve ───────────────────────────────────────────────────
function getReserve() {
  return get(KEYS.RESERVE, { saldo: 0, historico: [] });
}

function updateReserve(delta, motivo, ym) {
  const r   = getReserve();
  r.saldo   = Math.max(0, r.saldo + delta);
  r.historico.push({ ym, delta, motivo, ts: Date.now() });
  set(KEYS.RESERVE, r);
  return r.saldo;
}

function setReserveSaldo(saldo) {
  const r = getReserve();
  r.saldo = Math.max(0, saldo);
  set(KEYS.RESERVE, r);
}

// ── Goals ─────────────────────────────────────────────────────
function getGoals() { return get(KEYS.GOALS, []); }
function setGoals(arr) { set(KEYS.GOALS, arr); }

export {
  KEYS, migrate,
  getParams, setParams,
  getDiagnosis, setDiagnosis,
  getContracts, setContracts, upsertContract, removeContract,
  getTx, addTx, removeTx,
  getReserve, updateReserve, setReserveSaldo,
  getGoals, setGoals,
  get, set, remove, clearAll,
};
