// Motor contable base caja: cada Hecho aprobado se expande en LineaLibro[].
// Ninguna pantalla calcula sobre Hecho; todas leen líneas.
import type { Account, Entity, Transaction, LedgerLine, ResultClass, TransactionType } from './types'

const CLASS_BY_TYPE: Partial<Record<TransactionType, ResultClass>> = {
  income: 'income', cost: 'cost_of_sales', expense: 'operating_expense', interest: 'financial',
}

/** Dueña de la caja: la entidad pagadora (o la dueña de la cuenta, si se conoce). */
function cashHolder(h: Transaction, accounts: Map<string, Account>): string {
  const c = h.sourceAccountId ?? h.destinationAccountId
  return (c && accounts.get(c)?.entityId) || h.payerEntityId
}

export function expandTransaction(h: Transaction, accountList: Account[]): LedgerLine[] {
  const accounts = new Map(accountList.map((c) => [c.id, c]))
  const base = { transactionId: h.id, date: h.date }
  const L: LedgerLine[] = []
  const T = cashHolder(h, accounts)
  const singleProject = h.allocations.length === 1 ? h.allocations[0].projectId : undefined

  // Por cada parte asignada a otra entidad: deuda intercompañía.
  // `sentido` = 'T_cobra' cuando T pagó por el otro; 'T_debe' cuando T recibió plata del otro.
  const ic = (other: string, amount: number, direction: 'T_cobra' | 'T_debe', projectId?: string) => {
    const [creditor, debtor] = direction === 'T_cobra' ? [T, other] : [other, T]
    L.push({ ...base, entityId: creditor, concept: 'ic_receivable', amount, counterpartId: debtor, projectId })
    L.push({ ...base, entityId: debtor, concept: 'ic_payable', amount, counterpartId: creditor, projectId })
  }

  switch (h.type) {
    case 'expense': case 'cost': case 'interest': case 'project_investment': {
      L.push({ ...base, entityId: T, concept: 'cash', accountId: h.sourceAccountId, amount: -h.amount, projectId: singleProject })
      for (const a of h.allocations) {
        if (h.type === 'project_investment') L.push({ ...base, entityId: a.entityId, concept: 'investment', amount: a.amount, projectId: a.projectId })
        else L.push({ ...base, entityId: a.entityId, concept: 'result', amount: -a.amount, resultClass: CLASS_BY_TYPE[h.type], projectId: a.projectId })
        if (a.entityId !== T) ic(a.entityId, a.amount, 'T_cobra', a.projectId)
      }
      break
    }
    case 'income': {
      L.push({ ...base, entityId: T, concept: 'cash', accountId: h.destinationAccountId, amount: h.amount, projectId: singleProject })
      for (const a of h.allocations) {
        L.push({ ...base, entityId: a.entityId, concept: 'result', amount: a.amount, resultClass: 'income', projectId: a.projectId })
        if (a.entityId !== T) ic(a.entityId, a.amount, 'T_debe', a.projectId)
      }
      break
    }
    case 'transfer': case 'intercompany_payment': {
      const source = (h.sourceAccountId && accounts.get(h.sourceAccountId)?.entityId) || h.payerEntityId
      const destination = (h.destinationAccountId && accounts.get(h.destinationAccountId)?.entityId) || h.allocations[0]?.entityId || source
      L.push({ ...base, entityId: source, concept: 'cash', accountId: h.sourceAccountId, amount: -h.amount })
      L.push({ ...base, entityId: destination, concept: 'cash', accountId: h.destinationAccountId, amount: h.amount })
      if (source !== destination) {
        // El que paga reduce lo que debe; el que recibe reduce lo que le deben.
        L.push({ ...base, entityId: source, concept: 'ic_payable', amount: -h.amount, counterpartId: destination })
        L.push({ ...base, entityId: destination, concept: 'ic_receivable', amount: -h.amount, counterpartId: source })
      }
      break
    }
    case 'loan_disbursement': {
      const D = h.allocations[0]?.entityId ?? T
      L.push({ ...base, entityId: T, concept: 'cash', accountId: h.destinationAccountId, amount: h.amount })
      L.push({ ...base, entityId: D, concept: 'loan', amount: h.amount })
      if (D !== T) ic(D, h.amount, 'T_debe')
      break
    }
    case 'loan_payment': {
      const D = h.allocations[0]?.entityId ?? T
      const d = h.loanPaymentBreakdown ?? { capital: h.amount, interest: 0, fees: 0 }
      L.push({ ...base, entityId: T, concept: 'cash', accountId: h.sourceAccountId, amount: -h.amount })
      if (d.capital) L.push({ ...base, entityId: D, concept: 'loan', amount: -d.capital })
      if (d.interest + d.fees) L.push({ ...base, entityId: D, concept: 'result', amount: -(d.interest + d.fees), resultClass: 'financial' })
      if (D !== T) ic(D, h.amount, 'T_cobra')
      break
    }
  }
  return L
}

export const expandAll = (transactions: Transaction[], accounts: Account[]) => transactions.flatMap((h) => expandTransaction(h, accounts))

// ---------- Alcance (grupo / entidad / proyecto) ----------
export type Scope =
  | { type: 'group'; includePersonal: boolean }
  | { type: 'entity'; entityId: string }
  | { type: 'project'; projectId: string }

export function filterScope(lines: LedgerLine[], scope: Scope, entities: Entity[]): LedgerLine[] {
  if (scope.type === 'entity') return lines.filter((l) => l.entityId === scope.entityId)
  const withoutIc = lines.filter((l) => l.concept !== 'ic_receivable' && l.concept !== 'ic_payable')
  if (scope.type === 'project') return withoutIc.filter((l) => l.projectId === scope.projectId)
  if (scope.includePersonal) return withoutIc
  const personalIds = new Set(entities.filter((e) => e.isPersonal).map((e) => e.id))
  return withoutIc.filter((l) => !personalIds.has(l.entityId))
}

export const inRange = (l: { date: string }, from?: string, to?: string) =>
  (!from || l.date >= from) && (!to || l.date <= to)

// ---------- Intercompañías ----------
/** Saldo neto que `deudor` le debe a `acreedor` (positivo = debe). */
export function debtBetween(lines: LedgerLine[], debtor: string, creditor: string): { value: number; lines: LedgerLine[] } {
  const ls = lines.filter((l) => l.concept === 'ic_payable' &&
    ((l.entityId === debtor && l.counterpartId === creditor) || (l.entityId === creditor && l.counterpartId === debtor)))
  const value = ls.reduce((s, l) => s + (l.entityId === debtor ? l.amount : -l.amount), 0)
  return { value, lines: ls }
}

/** Matriz neta: matriz[deudor][acreedor] > 0 sólo en la dirección en que hay deuda. */
export function intercompanyMatrix(lines: LedgerLine[], entityIds: string[]) {
  const m: Record<string, Record<string, number>> = {}
  for (const d of entityIds) {
    m[d] = {}
    for (const a of entityIds) m[d][a] = d === a ? 0 : Math.max(0, debtBetween(lines, d, a).value)
  }
  return m
}

// ---------- Saldos ----------
export function accountBalance(account: Account, lines: LedgerLine[], to?: string): number {
  return account.openingBalance + lines
    .filter((l) => l.concept === 'cash' && l.accountId === account.id && (!to || l.date <= to))
    .reduce((s, l) => s + l.amount, 0)
}

export const sum = (ls: LedgerLine[]) => ls.reduce((s, l) => s + l.amount, 0)
