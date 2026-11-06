// Amortización de créditos con cuota fija (sistema francés).
import { addMonths, format, parseISO } from 'date-fns'
import type { Loan, RateType } from './types'

export const monthlyRate = (t: { value: number; type: RateType }) =>
  t.type === 'EA' ? Math.pow(1 + t.value, 1 / 12) - 1 : t.value

export const baseInstallment = (P: number, i: number, n: number) =>
  i === 0 ? Math.round(P / n) : Math.round((P * i) / (1 - Math.pow(1 + i, -n)))

export type AmortizationRow = {
  number: number; date: string; baseInstallment: number; interest: number; capital: number
  fees: number; total: number; balance: number; monthlyRate: number
}

export const installmentDate = (firstDueDate: string, k: number) =>
  format(addMonths(parseISO(firstDueDate), k - 1), 'yyyy-MM-dd')

type LoanTerms = Pick<Loan, 'amount' | 'rate' | 'installmentCount' | 'firstDueDate' | 'feesPerInstallment'> & { changes?: Loan['changes'] }

/** Tabla completa. Los cambios (tasa nueva, abono extra) se aplican desde la primera cuota con fecha >= al cambio y recalculan la cuota manteniendo el plazo. */
export function amortizationSchedule(c: LoanTerms): AmortizationRow[] {
  let i = monthlyRate(c.rate)
  let balance = c.amount
  let installment = baseInstallment(balance, i, c.installmentCount)
  const changes = [...(c.changes ?? [])].sort((a, b) => a.date.localeCompare(b.date))
  let ci = 0
  const rows: AmortizationRow[] = []
  for (let k = 1; k <= c.installmentCount; k++) {
    const date = installmentDate(c.firstDueDate, k)
    let recompute = false
    while (ci < changes.length && changes[ci].date <= date) {
      const cb = changes[ci++]
      if (cb.type === 'rate') i = monthlyRate({ value: cb.value, type: c.rate.type })
      else balance = Math.max(0, balance - cb.value)
      recompute = true
    }
    if (recompute) installment = baseInstallment(balance, i, c.installmentCount - k + 1)
    const interest = Math.round(balance * i)
    const isLast = k === c.installmentCount
    const capital = isLast ? balance : Math.min(balance, installment - interest)
    balance -= capital
    rows.push({
      number: k, date, baseInstallment: capital + interest, interest, capital,
      fees: c.feesPerInstallment, total: capital + interest + c.feesPerInstallment, balance, monthlyRate: i,
    })
  }
  return rows
}

export type InstallmentStatus = 'paid' | 'overdue' | 'upcoming'
export type RowWithStatus = AmortizationRow & { status: InstallmentStatus; transactionId?: string }

export function loanStatus(c: Loan, today: string) {
  const table = amortizationSchedule(c)
  const paidByNumber = new Map(c.payments.filter((p) => p.installmentNumber > 0).map((p) => [p.installmentNumber, p]))
  const rows: RowWithStatus[] = table.map((f) => ({
    ...f,
    status: paidByNumber.has(f.number) ? 'paid' : f.date < today ? 'overdue' : 'upcoming',
    transactionId: paidByNumber.get(f.number)?.transactionId,
  }))
  const principalPaid = c.payments.reduce((s, p) => s + p.capital, 0)
  const actualBalance = c.amount - principalPaid
  const lastDue = [...table].reverse().find((f) => f.date <= today)
  const scheduleBalance = lastDue ? lastDue.balance : c.amount
  const overdue = rows.filter((f) => f.status === 'overdue')
  const next = rows.find((f) => f.status !== 'paid')
  const lastBankBalance = [...c.bankBalances].sort((a, b) => a.date.localeCompare(b.date)).at(-1)
  return {
    rows, actualBalance, scheduleBalance, overdue, next,
    interestPaid: c.payments.reduce((s, p) => s + p.interest, 0),
    feesPaid: c.payments.reduce((s, p) => s + p.fees, 0),
    monthlyRate: monthlyRate(c.rate),
    baseInstallment: table[0]?.baseInstallment ?? 0,
    totalInstallment: (table[0]?.baseInstallment ?? 0) + c.feesPerInstallment,
    bankBalance: lastBankBalance,
    bankDifference: lastBankBalance ? lastBankBalance.balance - actualBalance : undefined,
  }
}

/** Serie para la gráfica: saldo según la tabla vs saldo real (por pagos) en cada fecha de cuota. */
export function balanceSeries(c: Loan, today: string) {
  const table = amortizationSchedule(c)
  return table.map((f) => ({
    date: f.date,
    table: f.balance,
    real: f.date <= today ? c.amount - c.payments.filter((p) => p.date <= f.date).reduce((s, p) => s + p.capital, 0) : null,
  }))
}
