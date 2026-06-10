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

/** Totaliza fixas + dívidas do diagnóstico */
export function monthlyCost(diagnosis) {
  const fixas   = (diagnosis?.fixas   || []).reduce((s,f) => s + Number(f.value), 0);
  const debts   = (diagnosis?.debts   || []).reduce((s,d) => s + Number(d.installment), 0);
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

/** Plano de distribuição para mês com renda */
export function planMonth(income, costTotal, saldoReserva, reserveMeta) {
  const afterCost = income - costTotal;
  if (afterCost <= 0) return { toReserve:0, toGoals:0, toFree:0, deficit: Math.abs(afterCost) };
  const gap        = Math.max(0, reserveMeta - saldoReserva);
  const toReserve  = Math.min(afterCost, gap);
  const free       = afterCost - toReserve;
  const reserveOk  = saldoReserva >= reserveMeta;
  const toGoals    = reserveOk ? Math.round(free * 0.5) : Math.round(free * 0.15);
  return { toReserve, toGoals, toFree: free - toGoals, deficit: 0 };
}

/** Contratos fechados com início no mês ym */
export function contractsOfMonth(list, ym) {
  return list.filter(c => c.status === 'closed' && c.startDate?.slice(0,7) === ym);
}

/** Total de comissões do mês */
export function incomeOfMonth(list, p, ym) {
  return contractsOfMonth(list, ym).reduce((s,c) => s + commission(c, p), 0);
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
