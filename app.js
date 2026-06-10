/* ============================================================
   Controle Financeiro — lógica principal
   Fluxo: diagnóstico → plano → acompanhamento
   ============================================================ */

// ── Storage helpers ──────────────────────────────────────────
const store = {
  get: (k, def = null) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; } },
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
  remove: (k) => localStorage.removeItem(k),
};

const KEY_DIAG  = 'fc_diagnosis';
const KEY_PLAN  = 'fc_plan';
const KEY_TX    = (ym) => `fc_tx_${ym}`;   // ym = '2026-06'
const KEY_GOAL  = 'fc_goal_progress';       // [{ym, valor}]

// ── Utilities ────────────────────────────────────────────────
const fmtBRL = (n) =>
  Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const ym = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

const monthName = (ymStr) => {
  const [y, m] = ymStr.split('-');
  return new Date(+y, +m - 1, 1)
    .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
};

function el(id) { return document.getElementById(id); }
function qs(sel, ctx = document) { return ctx.querySelector(sel); }
function qsa(sel, ctx = document) { return [...ctx.querySelectorAll(sel)]; }

// ── Envelope colours / icons ─────────────────────────────────
const ENVELOPE_META = {
  fixas:      { icon: '🏠', color: '#2563eb', bg: '#eff6ff' },
  dividas:    { icon: '💳', color: '#d97706', bg: '#fffbeb' },
  mercado:    { icon: '🛒', color: '#16a34a', bg: '#f0fdf4' },
  transporte: { icon: '🚗', color: '#7c3aed', bg: '#f5f3ff' },
  lazer:      { icon: '🎉', color: '#db2777', bg: '#fdf2f8' },
  poupanca:   { icon: '🎯', color: '#0891b2', bg: '#ecfeff' },
  reserva:    { icon: '🛡️', color: '#059669', bg: '#ecfdf5' },
};

// ── State ────────────────────────────────────────────────────
let currentView    = 'welcome';
let currentStep    = 1;
let currentMonthYM = ym();

// ── Navigation ───────────────────────────────────────────────
function showView(id) {
  qsa('.view').forEach(v => v.classList.remove('active'));
  const v = el(`view-${id}`);
  if (v) v.classList.add('active');
  currentView = id;

  const navViews = ['plan', 'tracking', 'meta', 'history'];
  el('bottom-nav').classList.toggle('visible', navViews.includes(id));
  el('fab').classList.toggle('visible', id === 'tracking');

  qsa('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.view === id);
  });
}

// ── App init ─────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  initNav();
  initDiagnosis();
  initModalClose();

  setTimeout(() => {
    el('splash').classList.add('hidden');
    const diag = store.get(KEY_DIAG);
    const plan = store.get(KEY_PLAN);
    if (diag && plan) {
      renderPlan();
      showView('plan');
    } else {
      showView('welcome');
    }
  }, 900);
});

// ── Bottom nav ───────────────────────────────────────────────
function initNav() {
  qsa('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.view;
      if (target === 'tracking') renderTracking();
      if (target === 'meta')     renderMeta();
      if (target === 'history')  renderHistory();
      if (target === 'plan')     renderPlan();
      showView(target);
    });
  });
}

// ══════════════════════════════════════════════════════════════
//  ETAPA 1 — DIAGNÓSTICO
// ══════════════════════════════════════════════════════════════
const TOTAL_STEPS = 6;

function initDiagnosis() {
  el('btn-start').addEventListener('click', () => {
    currentStep = 1;
    showView('diagnosis');
    renderStep();
  });

  el('btn-reset') && el('btn-reset').addEventListener('click', resetApp);

  el('btn-next').addEventListener('click', () => {
    if (!validateStep()) return;
    if (currentStep < TOTAL_STEPS) {
      currentStep++;
      renderStep();
    } else {
      finishDiagnosis();
    }
  });

  el('btn-prev').addEventListener('click', () => {
    if (currentStep > 1) { currentStep--; renderStep(); }
  });

  // dynamic lists
  el('btn-add-fixa').addEventListener('click', () => addListItem('fixas-list', fixaTemplate));
  el('btn-add-divida').addEventListener('click', () => addListItem('dividas-list', dividaTemplate));
}

function renderStep() {
  qsa('.step').forEach(s => s.classList.remove('active'));
  el(`step-${currentStep}`).classList.add('active');

  const pct = (currentStep / TOTAL_STEPS) * 100;
  el('step-progress-fill').style.width = `${pct}%`;
  el('step-label').textContent = `Etapa ${currentStep} de ${TOTAL_STEPS}`;

  el('btn-prev').style.display = currentStep === 1 ? 'none' : '';
  el('btn-next').textContent   = currentStep === TOTAL_STEPS ? 'Gerar plano ✓' : 'Próximo →';
}

// ── Step templates ───────────────────────────────────────────
function fixaTemplate() {
  return `
    <div class="list-item-fields">
      <input placeholder="Nome (ex: Aluguel)" class="fixa-nome" maxlength="40" />
      <div class="list-item-row">
        <input type="number" placeholder="Valor R$" class="fixa-valor" min="0" step="0.01" />
        <input type="number" placeholder="Dia venc." class="fixa-dia" min="1" max="31" style="max-width:90px" />
      </div>
    </div>`;
}

function dividaTemplate() {
  return `
    <div class="list-item-fields">
      <input placeholder="Tipo (ex: Cartão Nubank)" class="div-nome" maxlength="40" />
      <div class="list-item-row">
        <input type="number" placeholder="Parcela R$" class="div-parcela" min="0" step="0.01" />
        <input type="number" placeholder="Nº parcelas" class="div-num" min="1" max="360" style="max-width:90px" />
      </div>
    </div>`;
}

function addListItem(listId, templateFn) {
  const wrap = el(listId);
  const div  = document.createElement('div');
  div.className = 'list-item';
  div.innerHTML = templateFn() + `<button class="list-item-remove" onclick="this.closest('.list-item').remove()">✕</button>`;
  wrap.appendChild(div);
  div.querySelector('input')?.focus();
}

// ── Validation ───────────────────────────────────────────────
function validateStep() {
  if (currentStep === 1) {
    const v = parseFloat(el('renda').value);
    if (!v || v <= 0) { shake(el('renda')); return false; }
  }
  if (currentStep === 4) {
    const valMeta  = parseFloat(el('meta-valor').value);
    const prazo    = parseInt(el('meta-prazo').value);
    if (!valMeta || valMeta < 0) { shake(el('meta-valor')); return false; }
    if (!prazo   || prazo < 1)   { shake(el('meta-prazo'));  return false; }
  }
  return true;
}

function shake(el) {
  el.style.borderColor = 'var(--danger)';
  el.style.animation   = 'none';
  el.focus();
  setTimeout(() => { el.style.borderColor = ''; }, 1500);
}

// ── Read form data ────────────────────────────────────────────
function readDiagnosis() {
  const renda = parseFloat(el('renda').value) || 0;

  const fixas = qsa('#fixas-list .list-item').map(li => ({
    nome:  li.querySelector('.fixa-nome')?.value.trim() || 'Conta fixa',
    valor: parseFloat(li.querySelector('.fixa-valor')?.value) || 0,
    dia:   parseInt(li.querySelector('.fixa-dia')?.value) || 1,
  })).filter(f => f.valor > 0);

  const dividas = qsa('#dividas-list .list-item').map(li => ({
    nome:    li.querySelector('.div-nome')?.value.trim() || 'Dívida',
    parcela: parseFloat(li.querySelector('.div-parcela')?.value) || 0,
    num:     parseInt(li.querySelector('.div-num')?.value) || 1,
  })).filter(d => d.parcela > 0);

  const metaValor = parseFloat(el('meta-valor').value) || 0;
  const metaPrazo = parseInt(el('meta-prazo').value) || 12;
  const metaNome  = el('meta-nome').value.trim() || 'Meta principal';

  const mesesSemPoupar = parseInt(el('sem-poupar').value) || 0;
  const gastoExtra     = parseFloat(el('gasto-extra').value) || 0;

  const objetivos = qsa('#objetivos-list input:checked').map(c => c.value);

  return { renda, fixas, dividas, meta: { valor: metaValor, prazo: metaPrazo, nome: metaNome }, mesesSemPoupar, gastoExtra, objetivos, criadoEm: new Date().toISOString() };
}

// ══════════════════════════════════════════════════════════════
//  ETAPA 2 — GERAÇÃO DO PLANO
// ══════════════════════════════════════════════════════════════
function finishDiagnosis() {
  const diag = readDiagnosis();
  const plan = generatePlan(diag);

  // freio de realismo
  const totalEssencial = diag.fixas.reduce((s, f) => s + f.valor, 0)
    + diag.dividas.reduce((s, d) => s + d.parcela, 0)
    + plan.meta_mensal;

  if (totalEssencial > diag.renda * 0.95) {
    store.set(KEY_DIAG, diag);
    store.set(KEY_PLAN, plan);
    renderRealismAlert(diag, plan, totalEssencial);
    showView('realism');
    return;
  }

  store.set(KEY_DIAG, diag);
  store.set(KEY_PLAN, plan);
  renderPlan();
  showView('plan');
}

function generatePlan(diag) {
  const renda         = diag.renda;
  const totalFixas    = diag.fixas.reduce((s, f) => s + f.valor, 0);
  const totalDividas  = diag.dividas.reduce((s, d) => s + d.parcela, 0);
  const metaMensal    = diag.meta.prazo > 0 ? diag.meta.valor / diag.meta.prazo : 0;

  // saldo após compromissos
  let saldo = renda - totalFixas - totalDividas - metaMensal;
  if (saldo < 0) saldo = 0;

  // distribuição do saldo livre (baseada em 50/30/20 adaptado)
  const mercado      = Math.round(saldo * 0.35);
  const transporte   = Math.round(saldo * 0.20);
  const lazer        = Math.round(saldo * 0.30);
  const reserva      = Math.round(saldo * 0.15);

  return {
    renda,
    meta_mensal: Math.round(metaMensal),
    envelopes: [
      { id: 'fixas',      nome: 'Contas Fixas',   planejado: Math.round(totalFixas)   },
      { id: 'dividas',    nome: 'Dívidas',         planejado: Math.round(totalDividas) },
      { id: 'mercado',    nome: 'Mercado',          planejado: mercado      },
      { id: 'transporte', nome: 'Transporte',       planejado: transporte   },
      { id: 'lazer',      nome: 'Lazer / Outros',   planejado: lazer        },
      { id: 'poupanca',   nome: diag.meta.nome || 'Poupança/Meta', planejado: Math.round(metaMensal) },
      { id: 'reserva',    nome: 'Reserva',          planejado: reserva      },
    ].filter(e => e.planejado > 0),
    geradoEm: new Date().toISOString(),
  };
}

// ── Realism alert ─────────────────────────────────────────────
function renderRealismAlert(diag, plan, total) {
  const excesso = total - diag.renda;
  const prazoSugerido = diag.meta.valor > 0 ? Math.ceil(diag.meta.valor / (diag.renda * 0.10)) : 0;

  el('realism-content').innerHTML = `
    <div class="alert alert-danger">
      <span class="alert-icon">⚠️</span>
      <div>
        <strong>Plano não fecha com a renda atual.</strong><br>
        Seus compromissos somam <strong>${fmtBRL(total)}</strong> mas a renda é <strong>${fmtBRL(diag.renda)}</strong>.
        Faltam <strong>${fmtBRL(excesso)}</strong>.
      </div>
    </div>
    <p style="font-size:.9rem;color:var(--gray-700);line-height:1.6">
      Algumas opções para equilibrar o plano:
    </p>
    <div style="display:flex;flex-direction:column;gap:10px">
      ${prazoSugerido > 0 ? `<div class="alert alert-info"><span class="alert-icon">📅</span><div>Estender o prazo da meta para <strong>${prazoSugerido} meses</strong> reduz a parcela mensal para ~<strong>${fmtBRL(diag.renda * 0.10)}</strong>.</div></div>` : ''}
      <div class="alert alert-warn"><span class="alert-icon">✂️</span><div>Revise as contas fixas — existem assinaturas ou serviços que podem ser cortados?</div></div>
      <div class="alert alert-warn"><span class="alert-icon">💡</span><div>Renegociar dívidas pode reduzir o valor das parcelas e liberar espaço no orçamento.</div></div>
    </div>
    <button class="btn btn-primary" onclick="proceedAnyway()">Gerar plano mesmo assim</button>
    <button class="btn btn-secondary" onclick="showView('diagnosis');currentStep=1;renderStep()">Revisar dados</button>
  `;
}

window.proceedAnyway = () => {
  renderPlan();
  showView('plan');
};

// ══════════════════════════════════════════════════════════════
//  ETAPA 3 — PLANO (envelopes)
// ══════════════════════════════════════════════════════════════
function renderPlan() {
  const plan = store.get(KEY_PLAN);
  const diag = store.get(KEY_DIAG);
  if (!plan || !diag) return;

  const txs    = store.get(KEY_TX(currentMonthYM), []);
  const gastos = buildGastoMap(txs);
  const totalGasto = Object.values(gastos).reduce((s, v) => s + v, 0);
  const sobrou  = plan.renda - totalGasto;

  // header summary
  el('plan-renda').textContent      = fmtBRL(plan.renda);
  el('plan-gasto').textContent      = fmtBRL(totalGasto);
  el('plan-sobrou').textContent     = fmtBRL(sobrou);
  el('plan-month').textContent      = monthName(currentMonthYM);
  el('plan-month-short').textContent = new Date(currentMonthYM + '-02').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '');

  // envelopes
  const container = el('envelopes-container');
  container.innerHTML = '';
  plan.envelopes.forEach(env => {
    const gasto  = gastos[env.id] || 0;
    const saldo  = env.planejado - gasto;
    const pct    = env.planejado > 0 ? Math.min((gasto / env.planejado) * 100, 100) : 0;
    const status = pct >= 100 ? 'danger' : pct >= 70 ? 'warn' : 'ok';
    const meta   = ENVELOPE_META[env.id] || { icon: '📂', color: '#64748b', bg: '#f1f5f9' };

    container.innerHTML += `
      <div class="envelope-card ${status === 'ok' ? '' : status}" data-env-id="${env.id}">
        <div class="envelope-header">
          <div class="envelope-icon" style="background:${meta.bg}; color:${meta.color}">${meta.icon}</div>
          <div>
            <div class="envelope-name">${env.nome}</div>
            <div style="font-size:.72rem;color:var(--gray-400)">Planejado: ${fmtBRL(env.planejado)}</div>
          </div>
          <span class="envelope-badge badge-${status}">
            ${status === 'ok' ? 'OK' : status === 'warn' ? 'Atenção' : 'Estourado'}
          </span>
        </div>
        <div class="envelope-amounts">
          <span>Gasto: <strong>${fmtBRL(gasto)}</strong></span>
          <span>Saldo: <strong class="${saldo < 0 ? 'text-danger' : ''}">${fmtBRL(saldo)}</strong></span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill ${status}" style="width:${pct}%"></div>
        </div>
        <button class="envelope-add-btn" onclick="openAddExpense('${env.id}','${env.nome}')">+ Lançar gasto</button>
      </div>`;
  });

  // disclaimer
  el('plan-disclaimer').style.display = '';
}

function buildGastoMap(txs) {
  const map = {};
  txs.forEach(tx => { map[tx.envelopeId] = (map[tx.envelopeId] || 0) + tx.valor; });
  return map;
}

// ══════════════════════════════════════════════════════════════
//  ACOMPANHAMENTO — LANÇAR GASTO (modal)
// ══════════════════════════════════════════════════════════════
function openAddExpense(envId, envNome) {
  const plan = store.get(KEY_PLAN);
  if (!plan) return;

  // build select options
  const opts = plan.envelopes.map(e =>
    `<option value="${e.id}" ${e.id === envId ? 'selected' : ''}>${e.nome}</option>`
  ).join('');

  el('modal-add-content').innerHTML = `
    <div class="field">
      <label>Categoria</label>
      <select id="add-env">${opts}</select>
    </div>
    <div class="field">
      <label>Valor</label>
      <div class="input-prefix"><span>R$</span><input type="number" id="add-valor" placeholder="0,00" min="0.01" step="0.01" inputmode="decimal" /></div>
    </div>
    <div class="field">
      <label>Descrição (opcional)</label>
      <input type="text" id="add-desc" placeholder="Ex: Supermercado Extra" maxlength="60" />
    </div>
    <div class="field">
      <label>Data</label>
      <input type="date" id="add-data" value="${new Date().toISOString().slice(0,10)}" />
    </div>
    <button class="btn btn-primary" onclick="confirmAddExpense()">Confirmar lançamento</button>
  `;

  el('modal-add').classList.add('open');
  setTimeout(() => el('add-valor')?.focus(), 100);
}

window.confirmAddExpense = () => {
  const envId = el('add-env').value;
  const valor = parseFloat(el('add-valor').value);
  if (!valor || valor <= 0) { shake(el('add-valor')); return; }

  const desc  = el('add-desc').value.trim() || ENVELOPE_META[envId]?.icon + ' Lançamento';
  const data  = el('add-data').value || new Date().toISOString().slice(0,10);
  const txYM  = data.slice(0,7);

  const txs = store.get(KEY_TX(txYM), []);
  txs.push({ id: Date.now(), envelopeId: envId, valor, descricao: desc, data });
  store.set(KEY_TX(txYM), txs);

  // special: poupança → atualiza progresso da meta
  if (envId === 'poupanca') {
    const hist = store.get(KEY_GOAL, []);
    const existing = hist.find(h => h.ym === txYM);
    if (existing) existing.valor += valor;
    else hist.push({ ym: txYM, valor });
    store.set(KEY_GOAL, hist);
  }

  closeModal('modal-add');
  renderPlan();
  if (currentView === 'tracking') renderTracking();
  if (currentView === 'meta')     renderMeta();
};

window.openAddExpense = openAddExpense;

// ══════════════════════════════════════════════════════════════
//  TRACKING VIEW
// ══════════════════════════════════════════════════════════════
function renderTracking() {
  const txs = store.get(KEY_TX(currentMonthYM), []);
  const plan = store.get(KEY_PLAN);

  // month pills (last 4 months)
  const pills = el('month-pills');
  pills.innerHTML = '';
  for (let i = 3; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const y = ym(d);
    const btn = document.createElement('button');
    btn.className = 'month-pill' + (y === currentMonthYM ? ' active' : '');
    btn.textContent = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.','');
    btn.dataset.ym = y;
    btn.addEventListener('click', () => { currentMonthYM = y; renderTracking(); renderPlan(); });
    pills.appendChild(btn);
  }

  // stats
  const renda       = plan?.renda || 0;
  const totalGasto  = txs.reduce((s, t) => s + t.valor, 0);
  const sobrou      = renda - totalGasto;
  el('stat-entrou').textContent = fmtBRL(renda);
  el('stat-saiu').textContent   = fmtBRL(totalGasto);
  el('stat-sobrou').textContent = fmtBRL(sobrou);
  el('stat-sobrou-card').className = 'stat-card ' + (sobrou >= 0 ? 'positive' : 'negative');

  // transaction list
  const list = el('tx-list');
  if (txs.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <p>Nenhum gasto lançado neste mês.</p>
        <p>Use o botão + para registrar.</p>
      </div>`;
    return;
  }

  // sort by date desc
  const sorted = [...txs].sort((a,b) => b.data.localeCompare(a.data));
  list.innerHTML = sorted.map(tx => {
    const meta = ENVELOPE_META[tx.envelopeId] || { icon: '📂', bg: '#f1f5f9', color: '#64748b' };
    const d    = new Date(tx.data + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    return `
      <div class="tx-item">
        <div class="tx-icon" style="background:${meta.bg};color:${meta.color}">${meta.icon}</div>
        <div class="tx-info">
          <div class="tx-desc">${tx.descricao}</div>
          <div class="tx-meta">${d} · ${plan?.envelopes.find(e=>e.id===tx.envelopeId)?.nome || tx.envelopeId}</div>
        </div>
        <div class="tx-amount">- ${fmtBRL(tx.valor)}</div>
        <button class="tx-delete" onclick="deleteTransaction('${tx.id}','${currentMonthYM}')">🗑</button>
      </div>`;
  }).join('');
}

window.deleteTransaction = (id, ymStr) => {
  const txs = store.get(KEY_TX(ymStr), []);
  const tx  = txs.find(t => String(t.id) === String(id));

  // revert poupança goal tracking
  if (tx?.envelopeId === 'poupanca') {
    const hist = store.get(KEY_GOAL, []);
    const h = hist.find(h => h.ym === ymStr);
    if (h) { h.valor = Math.max(0, h.valor - tx.valor); store.set(KEY_GOAL, hist); }
  }

  store.set(KEY_TX(ymStr), txs.filter(t => String(t.id) !== String(id)));
  renderTracking();
  renderPlan();
  if (currentView === 'meta') renderMeta();
};

// ══════════════════════════════════════════════════════════════
//  META VIEW
// ══════════════════════════════════════════════════════════════
function renderMeta() {
  const diag = store.get(KEY_DIAG);
  const plan = store.get(KEY_PLAN);
  if (!diag || !plan) return;

  const metaValor  = diag.meta.valor;
  const metaPrazo  = diag.meta.prazo;
  const metaNome   = diag.meta.nome || 'Meta';
  const hist       = store.get(KEY_GOAL, []);
  const totalPoupado = hist.reduce((s, h) => s + h.valor, 0);
  const pct          = metaValor > 0 ? Math.min((totalPoupado / metaValor) * 100, 100) : 0;

  // meses desde criação
  const criado     = new Date(diag.criadoEm || Date.now());
  const agora      = new Date();
  const mesesPassados = Math.max(1, Math.round((agora - criado) / (1000 * 60 * 60 * 24 * 30)));
  const mediaMensal   = totalPoupado / mesesPassados;
  const mesesRestantes = metaValor > 0 && mediaMensal > 0
    ? Math.ceil((metaValor - totalPoupado) / mediaMensal)
    : metaPrazo;
  const onTrack = mesesRestantes <= metaPrazo;

  el('goal-nome').textContent   = metaNome;
  el('goal-poupado').textContent = fmtBRL(totalPoupado);
  el('goal-total').textContent   = fmtBRL(metaValor);
  el('goal-pct').textContent     = pct.toFixed(0) + '%';
  el('goal-bar-fill').style.width = pct + '%';

  el('goal-stats').innerHTML = `
    <div class="goal-stat">
      <div class="g-label">Meta</div>
      <div class="g-val">${fmtBRL(metaValor)}</div>
      <div class="g-sub">em ${metaPrazo} meses</div>
    </div>
    <div class="goal-stat">
      <div class="g-label">Guardado</div>
      <div class="g-val">${fmtBRL(totalPoupado)}</div>
      <div class="g-sub">${pct.toFixed(1)}% da meta</div>
    </div>
    <div class="goal-stat">
      <div class="g-label">Falta</div>
      <div class="g-val">${fmtBRL(Math.max(0, metaValor - totalPoupado))}</div>
      <div class="g-sub">para completar</div>
    </div>
    <div class="goal-stat">
      <div class="g-label">Ritmo</div>
      <div class="g-val ${onTrack ? 'on-track' : 'off-track'}">${onTrack ? '✅ No prazo' : '⚠️ Atrasado'}</div>
      <div class="g-sub">~${mesesRestantes} meses restantes</div>
    </div>
  `;

  // history of contributions
  const histList = el('goal-history');
  if (hist.length === 0) {
    histList.innerHTML = '<div class="empty-state" style="padding:20px"><div class="empty-icon">🏦</div><p>Nenhum aporte ainda.<br>Lance gastos na categoria da sua meta.</p></div>';
    return;
  }
  histList.innerHTML = hist.slice().reverse().map(h => `
    <div class="tx-item">
      <div class="tx-icon" style="background:#ecfeff;color:#0891b2">🎯</div>
      <div class="tx-info">
        <div class="tx-desc">${monthName(h.ym)}</div>
      </div>
      <div class="tx-amount" style="color:var(--success)">+ ${fmtBRL(h.valor)}</div>
    </div>`).join('');
}

// ══════════════════════════════════════════════════════════════
//  HISTORY VIEW
// ══════════════════════════════════════════════════════════════
function renderHistory() {
  const plan = store.get(KEY_PLAN);
  if (!plan) return;

  // build last 6 months of data
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const y = ym(d);
    const txs   = store.get(KEY_TX(y), []);
    const total = txs.reduce((s, t) => s + t.valor, 0);
    months.push({ ym: y, label: d.toLocaleDateString('pt-BR', { month: 'short' }), total, renda: plan.renda });
  }

  // category breakdown for current month
  const txsNow  = store.get(KEY_TX(currentMonthYM), []);
  const catMap  = {};
  txsNow.forEach(tx => { catMap[tx.envelopeId] = (catMap[tx.envelopeId] || 0) + tx.valor; });

  destroyCharts();
  renderBarChart(months);
  renderPieChart(catMap, plan.envelopes);
}

let chartBar = null, chartPie = null;

function destroyCharts() {
  if (chartBar) { chartBar.destroy(); chartBar = null; }
  if (chartPie) { chartPie.destroy(); chartPie = null; }
}

function renderBarChart(months) {
  const ctx = el('chart-bar')?.getContext('2d');
  if (!ctx) return;
  chartBar = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months.map(m => m.label),
      datasets: [
        {
          label: 'Gasto',
          data: months.map(m => m.total),
          backgroundColor: 'rgba(220,38,38,.7)',
          borderRadius: 6,
        },
        {
          label: 'Renda',
          data: months.map(m => m.renda),
          backgroundColor: 'rgba(37,99,235,.15)',
          borderColor: 'rgba(37,99,235,.4)',
          borderWidth: 1.5,
          type: 'line',
          fill: false,
          tension: 0.3,
          pointRadius: 3,
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } },
      scales: {
        y: { ticks: { callback: v => 'R$' + (v/1000).toFixed(0) + 'k', font: { size: 10 } } },
        x: { ticks: { font: { size: 11 } } },
      },
    },
  });
}

function renderPieChart(catMap, envelopes) {
  const ctx = el('chart-pie')?.getContext('2d');
  if (!ctx) return;
  const labels = [], data = [], colors = [];
  const palette = ['#2563eb','#16a34a','#d97706','#7c3aed','#db2777','#0891b2','#059669','#dc2626'];
  let ci = 0;
  envelopes.forEach(e => {
    if (catMap[e.id]) {
      labels.push(e.nome);
      data.push(catMap[e.id]);
      colors.push(palette[ci++ % palette.length]);
    }
  });
  if (data.length === 0) {
    el('chart-pie-wrap').innerHTML = '<div class="empty-state" style="padding:24px"><div class="empty-icon">📊</div><p>Sem gastos no mês atual.</p></div>';
    return;
  }
  chartPie = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 10 } },
        tooltip: { callbacks: { label: c => ` ${fmtBRL(c.parsed)}` } },
      },
    },
  });
}

// ══════════════════════════════════════════════════════════════
//  MODAL helpers
// ══════════════════════════════════════════════════════════════
function initModalClose() {
  qsa('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', e => {
      if (e.target === backdrop) closeModal(backdrop.id);
    });
  });
  qsa('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));
  });
}

function closeModal(id) { el(id)?.classList.remove('open'); }
window.closeModal = closeModal;

// ══════════════════════════════════════════════════════════════
//  RESET
// ══════════════════════════════════════════════════════════════
function resetApp() {
  if (!confirm('Tem certeza? Todos os dados serão apagados.')) return;
  ['fc_diagnosis','fc_plan','fc_goal_progress'].forEach(k => store.remove(k));
  // remove all monthly tx
  Object.keys(localStorage).filter(k => k.startsWith('fc_tx_')).forEach(k => localStorage.removeItem(k));
  location.reload();
}
window.resetApp = resetApp;

// ── FAB ──────────────────────────────────────────────────────
el('fab')?.addEventListener('click', () => {
  const plan = store.get(KEY_PLAN);
  if (plan?.envelopes?.length) openAddExpense(plan.envelopes[0].id, plan.envelopes[0].nome);
});
