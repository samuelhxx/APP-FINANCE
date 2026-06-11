/**
 * calc.js — pure financial calculation functions (no DOM, no side effects)
 */

export const fmt = (n) =>
  Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const fmtShort = (n) => {
  n = Number(n || 0);
  if (Math.abs(n) >= 1_000_000) return 'R$ ' + (n/1e6).toFixed(1).replace('.',',') + 'M';
  if (Math.abs(n) >= 1_000)     return 'R$ ' + (n/1e3).toFixed(1).replace('.',',') + 'k';
  return fmt(n);
};

export const ymNow = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;

export const ymLabel = (ym, opts = { month:'long', year:'numeric' }) => {
  const [y, m] = ym.split('-');
  return new Date(+y, +m-1, 1).toLocaleDateString('pt-BR', opts);
};

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,6);

/** Comissão de um contrato */
export function commission(contract, p) {
  if (contract.override != null && contract.override !== '') return Number(contract.override);
  return (Number(contract.value) * p.pct / 100) + p.fixed;
}

/** Total já recebido de um contrato */
export function totalReceived(contract) {
  return (contract.receipts || []).reduce((s, r) => s + Number(r.value), 0);
}

/** Valor ainda a receber de um contrato */
export function toReceive(contract, p) {
  return Math.max(0, commission(contract, p) - totalReceived(contract));
}

/** Totaliza fixas + dívidas do diagnóstico */
export function monthlyCost(diagnosis) {
  const fixas = (diagnosis?.fixas || []).reduce((s,f) => s + Number(f.value), 0);
  const debts = (diagnosis?.debts || []).reduce((s,d) => s + Number(d.installment), 0);
  return { fixas, debts, total: fixas + debts };
}

/** Saúde da reserva */
export function reserveHealth(saldo, custoMensal, metaMeses) {
  if (!custoMensal) return { months: 0, pct: 100, status: 'healthy' };
  const months = saldo / custoMensal;
  const pct    = Math.min(months / metaMeses * 100, 100);
  const status = months >= metaMeses ? 'healthy' : months >= 1 ? 'warn' : 'critical';
  return { months, pct, status };
}

/** Soma do saldo atual de todas as dívidas */
export function currentDebtTotal(debts, debtStateMap) {
  if (!debts || !debts.length) return 0;
  return debts.reduce((s, d) => s + (debtStateMap[d.id] ?? Number(d.balance)), 0);
}

/**
 * Gera plano mensal com cascata de prioridades.
 * Método de aceleração: avalanche (maior juro) quando interestRate disponível,
 * snowball (menor saldo) caso contrário.
 */
export function generatePlan(diag, debtStateMap, income, reserveSaldo) {
  const fixas      = diag?.fixas  || [];
  const debts      = diag?.debts  || [];
  const metaMonths = diag?.metaMonths || 6;

  const totalFixas   = fixas.reduce((s, f) => s + Number(f.value), 0);
  const totalDebtMin = debts.reduce((s, d) => s + Number(d.installment), 0);
  const costTotal    = totalFixas + totalDebtMin;
  const meta1        = costTotal;
  const metaFull     = costTotal * metaMonths;

  let remaining = Math.max(0, Number(income));
  const deficit = Math.max(0, costTotal - remaining);

  // 1. Fixas
  const toFixas = Math.min(remaining, totalFixas);
  remaining    -= toFixas;

  // 2. Parcelas mínimas
  const toDebtMin = Math.min(remaining, totalDebtMin);
  remaining      -= toDebtMin;

  // 3. Reserva urgente → 1 mês
  const gap1            = Math.max(0, meta1 - reserveSaldo);
  const isReserveUrgent = gap1 > 0;
  const toReserveUrgent = Math.min(remaining, gap1);
  remaining            -= toReserveUrgent;

  // 4. Aceleração de dívidas
  // Avalanche (maior juro) se qualquer dívida tem interestRate; snowball caso contrário
  const hasRateInfo = debts.some(d => d.interestRate != null && d.interestRate !== '');
  const debtMethod  = hasRateInfo ? 'avalanche' : 'snowball';

  const reserveAfterUrgent = reserveSaldo + toReserveUrgent;
  const activeDebts = debts
    .filter(d => (debtStateMap[d.id] ?? Number(d.balance)) > 0)
    .map(d => ({ ...d, currentBalance: debtStateMap[d.id] ?? Number(d.balance) }))
    .sort(hasRateInfo
      ? (a, b) => (Number(b.interestRate) || 0) - (Number(a.interestRate) || 0)   // avalanche
      : (a, b) => a.currentBalance - b.currentBalance,                              // snowball
    );

  let toDebtExtra = 0;
  let targetDebt  = null;

  if (activeDebts.length > 0 && reserveAfterUrgent >= meta1 && remaining > 0) {
    const focus = activeDebts[0];
    const cap   = Math.min(
      Math.round(remaining * 0.6),
      Math.max(0, focus.currentBalance - focus.installment),
    );
    toDebtExtra = Math.max(0, cap);
    remaining  -= toDebtExtra;
    targetDebt  = focus;
  }

  // 5. Reserva completa
  const gapFull       = Math.max(0, metaFull - reserveAfterUrgent);
  const toReserveFull = Math.min(remaining, gapFull);
  remaining          -= toReserveFull;

  const toReserveTotal  = toReserveUrgent + toReserveFull;
  const reserveComplete = reserveAfterUrgent >= metaFull;

  // 6. Livre / objetivos
  const toGoals = reserveComplete ? Math.round(remaining * 0.5) : Math.round(remaining * 0.15);
  const toFree  = remaining - toGoals;

  const projDebtMonths    = projectDebtPayoff(debts, debtStateMap, toDebtExtra, hasRateInfo);
  const projReserveMonths = toReserveTotal > 0
    ? Math.ceil(Math.max(0, metaFull - reserveSaldo) / toReserveTotal)
    : (reserveSaldo >= metaFull ? 0 : null);

  return {
    income: Number(income),
    toFixas, fixasList: fixas,
    toDebtMin, debtMinList: debts,
    toReserveUrgent, isReserveUrgent,
    toDebtExtra, targetDebt,
    toReserveFull, toReserveTotal,
    toGoals, toFree,
    deficit,
    costTotal, metaFull, meta1,
    reserveSaldo,
    projDebtMonths, projReserveMonths,
    reserveComplete, activeDebts,
    debtMethod,
  };
}

/**
 * Simula quitação de dívidas.
 * Avalanche: maior juro primeiro.  Snowball: menor saldo primeiro.
 * Retorna meses estimados (null se > 30 anos).
 */
export function projectDebtPayoff(debts, debtStateMap, extraPerMonth, useAvalanche = false) {
  if (!debts || !debts.length) return 0;

  const balances = debts.map(d => ({
    installment:  Number(d.installment),
    balance:      Math.max(0, debtStateMap[d.id] ?? Number(d.balance)),
    interestRate: Number(d.interestRate) || 0,
  }));

  if (balances.every(b => b.balance <= 0)) return 0;

  let months = 0;
  const MAX   = 360;

  while (balances.some(b => b.balance > 0) && months < MAX) {
    months++;
    let extra = Math.max(0, extraPerMonth);
    balances.sort(useAvalanche
      ? (a, b) => b.interestRate - a.interestRate
      : (a, b) => a.balance - b.balance,
    );
    for (const b of balances) {
      b.balance = Math.max(0, b.balance - b.installment);
      if (b.balance > 0 && extra > 0) {
        const pay = Math.min(extra, b.balance);
        b.balance -= pay;
        extra     -= pay;
      }
    }
  }

  return months >= MAX ? null : months;
}

/**
 * Gera frases-resumo da evolução financeira com base nos snapshots históricos.
 */
export function buildMonthSummary(allSnapshots, currentReserveSaldo, debts, debtStateMap, metaFull) {
  const phrases = [];
  if (!allSnapshots.length) return phrases;

  const oldest = allSnapshots[0];
  const n      = allSnapshots.length;

  // Reserva
  const oldRes = oldest.reserveEnd ?? 0;
  if (currentReserveSaldo > oldRes + 1) {
    phrases.push(`Reserva: de ${fmt(oldRes)} para ${fmt(currentReserveSaldo)} em ${n} ${n === 1 ? 'mês' : 'meses'}.`);
  } else if (currentReserveSaldo < oldRes - 1) {
    phrases.push(`Reserva caiu de ${fmt(oldRes)} para ${fmt(currentReserveSaldo)} em ${n} ${n === 1 ? 'mês' : 'meses'}.`);
  }

  // % da meta
  if (metaFull > 0) {
    const pct = Math.min(currentReserveSaldo / metaFull * 100, 100);
    phrases.push(`${pct.toFixed(0)}% da meta de reserva atingida.`);
  }

  // Dívida
  if (oldest.debtState && debts?.length) {
    const oldDebt = currentDebtTotal(debts, oldest.debtState);
    const nowDebt = currentDebtTotal(debts, debtStateMap);
    if (oldDebt > 0 && nowDebt < oldDebt - 1) {
      phrases.push(`Dívida caiu de ${fmt(oldDebt)} para ${fmt(nowDebt)} desde o início.`);
    }
  }

  return phrases;
}

/** Contratos fechados com início no mês ym */
export function contractsOfMonth(list, ym) {
  return list.filter(c => c.status === 'closed' && c.startDate?.slice(0,7) === ym);
}

/**
 * Renda real do mês = soma dos recebimentos registrados naquele mês
 * em qualquer contrato fechado.
 */
export function incomeOfMonth(list, _p, ym) {
  return list
    .filter(c => c.status === 'closed')
    .flatMap(c => c.receipts || [])
    .filter(r => r.date?.slice(0, 7) === ym)
    .reduce((s, r) => s + Number(r.value), 0);
}

/** Soma de transações */
export function sumTx(txs) {
  return txs.reduce((s,t) => s + Number(t.value), 0);
}

/** Gastos agrupados por categoria */
export function byCategory(txs) {
  const m = {};
  txs.forEach(t => { m[t.cat] = (m[t.cat]||0) + Number(t.value); });
  return m;
}
