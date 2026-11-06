// Indicadores base caja. Cada uno devuelve el valor, las líneas que lo forman (para el detalle)
// y cuántas propuestas pendientes lo afectarían.
import type { Account, Entity, LedgerLine, Proposal, Project } from './types'
import { type Scope, inRange, filterScope, sum } from './ledger'

export type Kpi = { value: number; lines: LedgerLine[]; pendingApproval: number }
export type KpiKey =
  | 'revenue' | 'grossProfit' | 'operatingResult' | 'netResult'
  | 'cashFlow' | 'projectInvestment' | 'cashBalance'

export const KPI_NAME: Record<KpiKey, string> = {
  revenue: 'Ingresos', grossProfit: 'Utilidad bruta', operatingResult: 'Resultado operativo',
  netResult: 'Resultado final', cashFlow: 'Flujo de caja', projectInvestment: 'Inversión en proyectos',
  cashBalance: 'Saldo de caja y bancos',
}

export type KpiContext = { entities: Entity[]; accounts: Account[]; projects: Project[]; pending: Proposal[] }

/** Entidades que cubre un alcance (para saldos iniciales y avisos de pendientes). */
function entitiesOf(scope: Scope, ctx: KpiContext): Set<string> {
  if (scope.type === 'entity') return new Set([scope.entityId])
  if (scope.type === 'project') return new Set(ctx.projects.filter((p) => p.id === scope.projectId).map((p) => p.entityId))
  return new Set(ctx.entities.filter((e) => scope.includePersonal || !e.isPersonal).map((e) => e.id))
}

/** Propuestas pendientes (no tareas) cuya fecha cae en el rango y que tocan el alcance. */
export function pendingInScope(scope: Scope, ctx: KpiContext, from?: string, to?: string): Proposal[] {
  const ents = entitiesOf(scope, ctx)
  return ctx.pending.filter((p) => {
    if (p.status !== 'pending' || p.type === 'task') return false
    const c = p.fields
    if (c.date && !inRange({ date: c.date }, from, to)) return false
    if (scope.type === 'project') return !!c.allocations?.some((a) => a.projectId === scope.projectId)
    const touched = [c.payerEntityId, ...(c.allocations ?? []).map((a) => a.entityId)].filter(Boolean) as string[]
    return touched.length === 0 || touched.some((e) => ents.has(e))
  })
}

/** Agrupa las líneas de caja por hecho y separa entradas/salidas netas (los movimientos internos se anulan). */
function netFlow(cashLines: LedgerLine[]) {
  const byTransaction = new Map<string, number>()
  for (const l of cashLines) byTransaction.set(l.transactionId, (byTransaction.get(l.transactionId) ?? 0) + l.amount)
  let inflows = 0, outflows = 0
  for (const v of byTransaction.values()) {
    if (v > 0) inflows += v
    else outflows -= v
  }
  const transactionsWithFlow = new Set([...byTransaction].filter(([, v]) => v !== 0).map(([k]) => k))
  return { inflows, outflows, lines: cashLines.filter((l) => transactionsWithFlow.has(l.transactionId)) }
}

export function computeKpis(
  allLines: LedgerLine[], scope: Scope, ctx: KpiContext, from?: string, to?: string,
): Record<KpiKey, Kpi> & { inflows: number; outflows: number } {
  const inScope = filterScope(allLines, scope, ctx.entities)
  const ls = inScope.filter((l) => inRange(l, from, to))
  const res = (kinds: string[]) => ls.filter((l) => l.concept === 'result' && kinds.includes(l.resultClass!))
  const pend = pendingInScope(scope, ctx, from, to).length

  const ing = res(['income'])
  const gross = res(['income', 'cost_of_sales'])
  const operating = res(['income', 'cost_of_sales', 'operating_expense'])
  const end = res(['income', 'cost_of_sales', 'operating_expense', 'financial'])
  const flow = netFlow(ls.filter((l) => l.concept === 'cash'))
  const inv = ls.filter((l) => l.concept === 'investment')

  // Saldo: saldos iniciales de las cuentas del alcance + todo el movimiento de caja hasta la fecha.
  const ents = entitiesOf(scope, ctx)
  const opening = scope.type === 'project' ? 0 : ctx.accounts.filter((c) => ents.has(c.entityId)).reduce((s, c) => s + c.openingBalance, 0)
  const cashToDate = inScope.filter((l) => l.concept === 'cash' && (!to || l.date <= to))

  const ind = (lines: LedgerLine[], value = sum(lines)): Kpi => ({ value, lines, pendingApproval: pend })
  return {
    revenue: ind(ing),
    grossProfit: ind(gross),
    operatingResult: ind(operating),
    netResult: ind(end),
    cashFlow: ind(flow.lines, flow.inflows - flow.outflows),
    projectInvestment: ind(inv),
    cashBalance: ind(cashToDate, opening + sum(cashToDate)),
    inflows: flow.inflows,
    outflows: flow.outflows,
  }
}

/** Ingresos vs egresos (salidas de caja) por mes, para la gráfica. */
export function monthlySeries(allLines: LedgerLine[], scope: Scope, ctx: KpiContext, months: string[]) {
  return months.map((month) => {
    const r = computeKpis(allLines, scope, ctx, `${month}-01`, `${month}-31`)
    return { month, revenue: r.inflows, outflows: r.outflows, result: r.netResult.value }
  })
}

/** Suma por entidad (para la tabla del grupo). */
export function summaryByEntity(allLines: LedgerLine[], ctx: KpiContext, from?: string, to?: string) {
  return ctx.entities.map((e) => {
    const r = computeKpis(allLines, { type: 'entity', entityId: e.id }, ctx, from, to)
    return { entity: e, revenue: r.revenue.value, netResult: r.netResult.value, cashFlow: r.cashFlow.value, cashBalance: r.cashBalance.value }
  })
}
