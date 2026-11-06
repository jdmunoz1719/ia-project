import { describe, expect, it } from 'vitest'
import { amortizationSchedule, monthlyRate, loanStatus } from './amortization'
import { expandAll, debtBetween, accountBalance } from './ledger'
import { computeKpis, type KpiContext } from './kpis'
import type { Loan, Account, Entity, Transaction } from './types'

const entities: Entity[] = [
  { id: 'A', name: 'Empresa A', alias: [], isPersonal: false },
  { id: 'B', name: 'Empresa B', alias: [], isPersonal: false },
  { id: 'C', name: 'Empresa C', alias: [], isPersonal: false },
]
const accounts: Account[] = [
  { id: 'banco-b', entityId: 'A', bank: 'Banco B', name: 'Banco B', alias: [], openingBalance: 10_000_000, openingBalanceDate: '2026-10-01' },
  { id: 'bancolombia', entityId: 'B', bank: 'Bancolombia', name: 'Bancolombia', alias: [], openingBalance: 10_000_000, openingBalanceDate: '2026-10-01' },
]
const ctx: KpiContext = { entities, accounts, projects: [], pending: [] }
const group = { type: 'group', includePersonal: true } as const
const transaction = (h: Partial<Transaction> & Pick<Transaction, 'id' | 'type' | 'amount' | 'payerEntityId' | 'allocations'>): Transaction =>
  ({ date: '2026-10-15', description: '', attachmentIds: [], approvedBy: 'test', approvedAt: '', ...h })

describe('Ejemplo 2: la Empresa B paga el arriendo de la Empresa A', () => {
  const rent = transaction({ id: 'h1', type: 'expense', amount: 2_350_000, sourceAccountId: 'bancolombia', payerEntityId: 'B', allocations: [{ entityId: 'A', amount: 2_350_000 }] })
  const lines = expandAll([rent], accounts)

  it('A tiene un gasto de $2.350.000', () => {
    expect(computeKpis(lines, { type: 'entity', entityId: 'A' }, ctx).operatingResult.value).toBe(-2_350_000)
  })
  it('B no tiene gasto, pero su cuenta baja $2.350.000', () => {
    expect(computeKpis(lines, { type: 'entity', entityId: 'B' }, ctx).netResult.value).toBe(0)
    expect(accountBalance(accounts[1], lines)).toBe(10_000_000 - 2_350_000)
  })
  it('A le debe $2.350.000 a B', () => {
    expect(debtBetween(lines, 'A', 'B').value).toBe(2_350_000)
    expect(debtBetween(lines, 'B', 'A').value).toBe(-2_350_000)
  })
  it('en el grupo el gasto aparece una vez y no hay deuda interna', () => {
    const g = computeKpis(lines, group, ctx)
    expect(g.netResult.value).toBe(-2_350_000)
    expect(g.netResult.lines).toHaveLength(1)
    expect([...g.cashBalance.lines, ...g.netResult.lines].some((l) => l.concept.endsWith('_ic'))).toBe(false)
  })
  it('cuando A le devuelve a B, la deuda queda en $0 y el grupo no ve entradas ni salidas', () => {
    const repayment = transaction({ id: 'h2', type: 'intercompany_payment', amount: 2_350_000, sourceAccountId: 'banco-b', destinationAccountId: 'bancolombia', payerEntityId: 'A', allocations: [{ entityId: 'B', amount: 2_350_000 }] })
    const ls = expandAll([rent, repayment], accounts)
    expect(debtBetween(ls, 'A', 'B').value).toBe(0)
    const g = computeKpis(ls, group, ctx)
    expect(g.netResult.value).toBe(-2_350_000)
    expect(g.outflows).toBe(2_350_000) // sólo el arriendo; la devolución es interna
    expect(computeKpis(ls, { type: 'entity', entityId: 'B' }, ctx).netResult.value).toBe(0)
  })
})

describe('Gasto repartido: arriendo de $3.000.000 pagado por A, 50 % A y 50 % C', () => {
  const h = transaction({ id: 'r1', type: 'expense', amount: 3_000_000, sourceAccountId: 'banco-b', payerEntityId: 'A',
    allocations: [{ entityId: 'A', amount: 1_500_000 }, { entityId: 'C', amount: 1_500_000 }] })
  const ls = expandAll([h], accounts)
  it('C le debe $1.500.000 a A', () => expect(debtBetween(ls, 'C', 'A').value).toBe(1_500_000))
  it('cada una registra su parte', () => {
    expect(computeKpis(ls, { type: 'entity', entityId: 'A' }, ctx).netResult.value).toBe(-1_500_000)
    expect(computeKpis(ls, { type: 'entity', entityId: 'C' }, ctx).netResult.value).toBe(-1_500_000)
  })
  it('el grupo muestra un solo gasto de $3.000.000', () => {
    const g = computeKpis(ls, group, ctx)
    expect(g.netResult.value).toBe(-3_000_000)
    expect(g.outflows).toBe(3_000_000)
  })
})

describe('Otros tipos de hecho', () => {
  it('inversión en proyecto no es gasto', () => {
    const ls = expandAll([transaction({ id: 'i', type: 'project_investment', amount: 5_000_000, sourceAccountId: 'banco-b', payerEntityId: 'A', allocations: [{ entityId: 'A', amount: 5_000_000 }] })], accounts)
    const r = computeKpis(ls, { type: 'entity', entityId: 'A' }, ctx)
    expect(r.netResult.value).toBe(0)
    expect(r.projectInvestment.value).toBe(5_000_000)
    expect(r.cashFlow.value).toBe(-5_000_000)
  })
  it('pago de crédito: capital baja deuda, interés y cargos son financieros', () => {
    const ls = expandAll([transaction({ id: 'p', type: 'loan_payment', amount: 2_914_933, sourceAccountId: 'banco-b', payerEntityId: 'A', allocations: [{ entityId: 'A', amount: 2_914_933 }], loanPaymentBreakdown: { capital: 2_189_076, interest: 680_857, fees: 45_000 } })], accounts)
    const r = computeKpis(ls, { type: 'entity', entityId: 'A' }, ctx)
    expect(r.operatingResult.value).toBe(0)
    expect(r.netResult.value).toBe(-725_857)
    expect(ls.find((l) => l.concept === 'loan')?.amount).toBe(-2_189_076)
  })
  it('las propuestas pendientes no cambian cifras, sólo el aviso', () => {
    const r = computeKpis([], group, { ...ctx, pending: [{ id: 'x', type: 'expense', fields: { date: '2026-10-10', payerEntityId: 'A', amount: 1 }, confidence: 90, evidence: [], status: 'pending' }] })
    expect(r.netResult.value).toBe(0)
    expect(r.netResult.pendingApproval).toBe(1)
  })
})

describe('Ejemplo 3: crédito de $60.000.000 al 14,5 % EA, 24 cuotas', () => {
  const loan: Loan = {
    id: 'c', name: 'Crédito constructor', bank: 'Davivienda', entityId: 'C', amount: 60_000_000,
    rate: { value: 0.145, type: 'EA' }, installmentCount: 24, firstDueDate: '2026-09-05', feesPerInstallment: 45_000,
    payments: [{ transactionId: 'h', installmentNumber: 1, capital: 2_189_076, interest: 680_857, fees: 45_000, date: '2026-09-05' }],
    bankBalances: [], changes: [],
  }
  const t = amortizationSchedule(loan)
  it('tasa mensual 1,1348 %', () => expect((monthlyRate(loan.rate) * 100).toFixed(4)).toBe('1.1348'))
  it('cuota financiera y total', () => {
    expect(t[0].baseInstallment).toBe(2_869_933)
    expect(t[0].total).toBe(2_914_933)
  })
  it('cuota 1', () => {
    expect(t[0].capital).toBe(2_189_076)
    expect(t[0].interest).toBe(680_857)
    expect(t[0].fees).toBe(45_000)
    expect(t[0].balance).toBe(57_810_924)
  })
  it('cuota 2', () => {
    expect(t[1].interest).toBe(656_016)
    expect(t[1].capital).toBe(2_213_917)
  })
  it('cuota 24 cierra en $0', () => {
    expect(t[23].balance).toBe(0)
    expect(t[23].capital).toBe(2_837_730)
    expect(t[23].interest).toBe(32_201)
  })
  it('al 28/10/2026: cuota 1 pagada, cuota 2 vencida', () => {
    const e = loanStatus(loan, '2026-10-28')
    expect(e.rows[0].status).toBe('paid')
    expect(e.rows[1].status).toBe('overdue')
    expect(e.rows[2].status).toBe('upcoming')
    expect(e.actualBalance).toBe(57_810_924)
  })
})
