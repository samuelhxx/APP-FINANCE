/**
 * calc.js — funções puras de cálculo financeiro
 * Sem efeitos colaterais, sem acesso ao DOM.
 */

/** Formata número como BRL */
export function fmtBRL(n) {
  return Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Formata número compacto (R$ 12,4k) */
export function fmtBRLShort(n) {
  n = Number(n || 0);
  if (Math.abs(n) >= 1_000_000) return 'R$ ' + (n / 1_000_000).toFixed(1).replace('.', ',') + 'M';
  if (Math.abs(n) >= 1_000)     return 'R$ ' + (n / 1_000).toFixed(1).replace('.', ',') + 'k';
  return fmtBRL(n);
}

/** Retorna 'YYYY-MM' da data atual */
export function ymNow(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Nome do mês por 'YYYY-MM' */
export function ymLabel(ym, opts = { month: 'long', year: 'numeric' }) {
  const [y, m] = ym.split('-');
  return new Date(+y, +m - 1, 1).toLocaleDateString('pt-BR', opts);
}

/** Calcula comissão de um contrato */
export function calcComissao(contract, params) {
  if (contract.comissao_override != null && contract.comissao_override !== '') {
    return Number(contract.comissao_override);
  }
  return (Number(contract.valor) * params.commission_pct / 100) + params.commission_fixed;
}

/**
 * Saúde da reserva.
 * Retorna { meses, status: 'healthy'|'warn'|'critical', pct }
 */
export function reserveHealth(saldoReserva, custoFixoMensal, metaMeses) {
  if (!custoFixoMensal || custoFixoMensal <= 0) return { meses: 0, status: 'healthy', pct: 100 };
  const meses = saldoReserva / custoFixoMensal;
  const pct   = Math.min((meses / metaMeses) * 100, 100);
  const status =
    meses >= metaMeses ? 'healthy' :
    meses >= 1         ? 'warn'    : 'critical';
  return { meses, status, pct };
}

/**
 * Totaliza contas fixas e dívidas do diagnóstico.
 * Retorna { fixas, dividas, total }
 */
export function calcCustoMensal(diagnosis) {
  const fixas   = (diagnosis?.fixas   || []).reduce((s, f) => s + Number(f.valor), 0);
  const dividas = (diagnosis?.dividas || []).reduce((s, d) => s + Number(d.parcela), 0);
  return { fixas, dividas, total: fixas + dividas };
}

/**
 * Plano de distribuição para um mês COM renda.
 * Retorna { para_reserva, para_objetivos, para_livre, deficit }
 */
export function planMonth(comissaoEntrada, custoTotal, saldoReserva, reservaMeta, params) {
  const aposCompromissos = comissaoEntrada - custoTotal;
  if (aposCompromissos <= 0) {
    return { para_reserva: 0, para_objetivos: 0, para_livre: 0, deficit: Math.abs(aposCompromissos) };
  }

  const faltaReserva    = Math.max(0, reservaMeta - saldoReserva);
  const para_reserva    = Math.min(aposCompromissos, faltaReserva);
  const livre_apos      = aposCompromissos - para_reserva;

  // reserva está cheia ou em dia — pode destinar a objetivos
  const reservaOk      = saldoReserva >= reservaMeta;
  const para_objetivos = reservaOk ? Math.round(livre_apos * 0.5) : Math.round(livre_apos * 0.2);
  const para_livre     = livre_apos - para_objetivos;

  return { para_reserva, para_objetivos, para_livre, deficit: 0 };
}

/**
 * Totaliza transações de um mês por categoria.
 * Retorna Map<categoria, total>
 */
export function sumByCategory(txs) {
  const map = new Map();
  txs.forEach(tx => {
    map.set(tx.categoria, (map.get(tx.categoria) || 0) + Number(tx.valor));
  });
  return map;
}

/** Soma total de transações */
export function sumTx(txs) {
  return txs.reduce((s, t) => s + Number(t.valor), 0);
}

/**
 * Comissões do mês (contratos fechados com data_inicio no mês ym).
 */
export function comissoesDoMes(contracts, params, ym) {
  return contracts
    .filter(c => c.status === 'fechado' && c.data_inicio?.slice(0, 7) === ym)
    .map(c => ({ ...c, comissao: calcComissao(c, params) }));
}

/** Total de comissões do mês */
export function totalComissoesDoMes(contracts, params, ym) {
  return comissoesDoMes(contracts, params, ym).reduce((s, c) => s + c.comissao, 0);
}

/** Gera ID único */
export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
