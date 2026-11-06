import { format, parseISO, subMonths } from 'date-fns'
import { computeAlerts, dueItems, addDaysIso } from '@/domain/schedule'
import { loanStatus } from '@/domain/amortization'
import { computeKpis, summaryByEntity, monthlySeries } from '@/domain/kpis'
import { type Scope, debtBetween, inRange, accountBalance } from '@/domain/ledger'
import type { LedgerLine } from '@/domain/types'
import { formatCOP, formatDate, formatMonth } from '@/lib/format'
import { normalizeText } from '@/services/ai/extractor'
import { context, delay, get, isTransactionVisible, visibleLines, entityName, pending, audit, set, visibleEntityIds } from './base'
import { TYPE_NAME } from './movements'

const transactionIds = (ls: LedgerLine[]) => [...new Set(ls.map((l) => l.transactionId))]
const endOfMonth = (ym: string) => format(new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0), 'yyyy-MM-dd')
export const lastMonths = (today: string, n = 6) => Array.from({ length: n }, (_, i) => format(subMonths(parseISO(today), n - 1 - i), 'yyyy-MM'))

function currentAlerts() {
  const s = get(); const v = visibleEntityIds()
  return computeAlerts({
    today: s.today, loans: s.loans.filter((c) => v.has(c.entityId)), obligations: s.obligations.filter((o) => v.has(o.entityId)),
    tasks: s.tasks.filter((t) => !t.entityId || v.has(t.entityId)), transactions: s.transactions.filter((h) => isTransactionVisible(h, v)),
    snoozed: s.snoozed, entityName,
  })
}

export const dashboards = {
  kpis: (scope: Scope, from?: string, to?: string) => delay(() => computeKpis(visibleLines(), scope, context(), from, to)),
  series: (scope: Scope) => delay(() => monthlySeries(visibleLines(), scope, context(), lastMonths(get().today))),
  byEntity: (from?: string, to?: string) => delay(() => summaryByEntity(visibleLines(), context(), from, to)),
  dataQuality: () => delay(() => {
    const s = get(); const v = visibleEntityIds()
    const transactions = s.transactions.filter((h) => isTransactionVisible(h, v))
    const previousMonth = format(subMonths(parseISO(s.today), 1), 'yyyy-MM')
    const unreconciled = s.accounts.filter((c) => v.has(c.entityId) && !s.monthCloses.some((x) => x.accountId === c.id && x.month === previousMonth && x.status === 'published'))
    const dups = s.inbox.flatMap((b) => b.proposals.filter((p) => p.status === 'pending' && (p.possibleDuplicateOf || b.duplicateFileOf)).map((p) => ({ itemId: b.id, proposal: p })))
    return {
      pending: pending().length,
      withoutAttachment: transactions.filter((h) => h.attachmentIds.length === 0).map((h) => h.id),
      unreconciledAccounts: unreconciled.map((c) => c.name), reconciliationMonth: previousMonth,
      duplicates: dups.length,
    }
  }),
}

export const home = {
  summary: () => delay(() => {
    const s = get()
    const month = s.today.slice(0, 7)
    const g: Scope = { type: 'group', includePersonal: false }
    const available = computeKpis(visibleLines(), g, context(), undefined, s.today)
    const res = computeKpis(visibleLines(), g, context(), `${month}-01`, s.today)
    return {
      cash: available.cashBalance, monthResult: res.netResult, month,
      pending: pending().length,
      pendingItems: s.inbox.filter((b) => b.status !== 'reviewed').length,
      alerts: currentAlerts().length,
      redAlerts: currentAlerts().filter((a) => a.level === 'red').length,
    }
  }),
  alerts: () => delay(currentAlerts),
  snooze: (alertId: string, days: number) => delay(() => {
    const to = addDaysIso(get().today, days)
    set((s) => ({ snoozed: { ...s.snoozed, [alertId]: to } }))
    audit('Pospuso alerta', alertId, `Hasta ${formatDate(to)}`)
  }, 100, 200),
  dueItems: (days = 30) => delay(() => {
    const s = get(); const v = visibleEntityIds()
    return dueItems({ today: s.today, days, loans: s.loans.filter((c) => v.has(c.entityId)), obligations: s.obligations.filter((o) => v.has(o.entityId)), tasks: s.tasks.filter((t) => !t.entityId || v.has(t.entityId)), entityName })
  }),
}

// ---------------- Informes ----------------
export const reports = {
  report: (scope: Scope, from: string, to: string) => delay(() => {
    const s = get()
    const ctx = context()
    const ind = computeKpis(visibleLines(), scope, ctx, from, to)
    const transactions = new Map(s.transactions.map((h) => [h.id, h]))
    const byCategory = new Map<string, { value: number; ids: Set<string> }>()
    for (const l of ind.netResult.lines) {
      const cat = s.categories.find((c) => c.id === transactions.get(l.transactionId)?.categoryId)?.name ?? 'Sin categoría'
      const k = `${l.resultClass}|${cat}`
      const x = byCategory.get(k) ?? { value: 0, ids: new Set() }
      x.value += l.amount; x.ids.add(l.transactionId); byCategory.set(k, x)
    }
    const categories = [...byCategory].map(([k, x]) => ({ kind: k.split('|')[0], category: k.split('|')[1], value: x.value, transactionIds: [...x.ids] }))
      .sort((a, b) => a.kind.localeCompare(b.kind) || Math.abs(b.value) - Math.abs(a.value))
    const accounts = ctx.accounts.filter((c) => scope.type === 'group' ? (scope.includePersonal || !s.entities.find((e) => e.id === c.entityId)?.isPersonal) : scope.type === 'entity' ? c.entityId === scope.entityId : false)
      .map((c) => ({ account: c, balance: accountBalance(c, visibleLines(), to) }))
    return { kpis: ind, categories, accounts, generatedAt: s.today }
  }),

  accountantPackage: (entityId: string, month: string) => delay(() => {
    const s = get()
    const hs = s.transactions.filter((h) => h.date.startsWith(month) && (h.payerEntityId === entityId || h.allocations.some((a) => a.entityId === entityId)))
    const n = (id?: string, arr: { id: string; name: string }[] = []) => arr.find((x) => x.id === id)?.name ?? ''
    const q = (v: string | number) => `"${String(v).replaceAll('"', '""')}"`
    const rows = [['Fecha', 'Tipo', 'Descripción', 'Monto', 'Empresa que paga', 'Empresa dueña', 'Proyecto', 'Cuenta', 'Categoría', 'Tercero', 'Soportes', 'Aprobado por'].map(q).join(';')]
    for (const h of hs) rows.push([
      formatDate(h.date), TYPE_NAME[h.type], h.description, h.amount, entityName(h.payerEntityId),
      h.allocations.map((a) => `${entityName(a.entityId)} (${a.amount})`).join(' + '),
      h.allocations.map((a) => s.projects.find((p) => p.id === a.projectId)?.name).filter(Boolean).join(', '),
      s.accounts.find((c) => c.id === (h.sourceAccountId ?? h.destinationAccountId))?.name ?? '',
      n(h.categoryId, s.categories), n(h.counterpartyId, s.counterparties),
      h.attachmentIds.map((id) => s.attachments.find((x) => x.id === id)?.name).join(' | ') || 'SIN SOPORTE', h.approvedBy,
    ].map(q).join(';'))
    audit('Descargó paquete para el contador', `${entityName(entityId)} · ${formatMonth(month)}`, `${hs.length} movimientos`)
    return {
      fileName: `paquete-contador-${entityName(entityId).toLowerCase().replace(/\s+/g, '-')}-${month}.csv`,
      csv: '﻿' + rows.join('\r\n'),
      movements: hs.length, withoutAttachment: hs.filter((h) => !h.attachmentIds.length).length,
      attachments: hs.flatMap((h) => h.attachmentIds).length,
    }
  }),
}

// ---------------- Chat (sólo consulta; usa las mismas funciones del dominio) ----------------
export type ChatAnswer = { text: string; figure?: number; transactionIds?: string[]; link?: { label: string; to: string } }
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export const SUGGESTED_QUESTIONS = [
  '¿Cuánto le debe la Empresa A a la Empresa B?',
  '¿Cuánto se gastó en nómina en octubre?',
  '¿Cuál es el saldo del crédito constructor?',
  '¿Cuánta plata hay disponible hoy?',
  '¿Cuál fue el resultado de la Empresa C en septiembre?',
  '¿Qué cuotas están vencidas?',
  '¿Cuántos movimientos no tienen soporte?',
  '¿Cuánto se ha invertido en la remodelación del local?',
]

function answer(question: string): ChatAnswer {
  const s = get(); const q = normalizeText(question); const v = visibleEntityIds()
  const ents = s.entities.filter((e) => v.has(e.id))
  const entitiesIn = (t: string) => ents.map((e) => ({ e, i: [normalizeText(e.name), ...e.alias.map(normalizeText)].map((a) => t.indexOf(a)).filter((i) => i >= 0).sort((a, b) => a - b)[0] ?? -1 })).filter((x) => x.i >= 0).sort((a, b) => a.i - b.i).map((x) => x.e)
  const monthIdx = MONTHS.findIndex((m) => q.includes(m))
  const year = q.match(/20\d\d/)?.[0] ?? s.today.slice(0, 4)
  const month = monthIdx >= 0 ? `${year}-${String(monthIdx + 1).padStart(2, '0')}` : undefined
  const range = month ? [`${month}-01`, endOfMonth(month)] as const : [undefined, s.today] as const
  const ctx = context(); const ls = visibleLines()
  const NO_DATA = { text: 'No tengo datos para responder eso. Prueba con una de las preguntas sugeridas.' }

  if (/debe/.test(q)) {
    const [a, b] = entitiesIn(q)
    if (!a || !b) return NO_DATA
    const d = debtBetween(ls, a.id, b.id)
    const text = d.value > 0 ? `${a.name} le debe ${formatCOP(d.value)} a ${b.name}.` : d.value < 0 ? `${a.name} no le debe a ${b.name}. Al contrario: ${b.name} le debe ${formatCOP(-d.value)} a ${a.name}.` : `${a.name} y ${b.name} están a paz y salvo.`
    return { text, figure: Math.abs(d.value), transactionIds: transactionIds(d.lines), link: { label: 'Ver en Entre empresas', to: '/entre-empresas' } }
  }
  const loan = s.loans.find((c) => v.has(c.entityId) && (q.includes(normalizeText(c.name)) || q.includes(normalizeText(c.name).replace(/^credito\s+/, ''))))
  if (loan && /saldo|debe|cuanto/.test(q)) {
    const e = loanStatus(loan, s.today)
    return { text: `El saldo real del ${loan.name.toLowerCase()} (${loan.bank}, ${entityName(loan.entityId)}) es ${formatCOP(e.actualBalance)}. Según la tabla debería ser ${formatCOP(e.scheduleBalance)}.${e.overdue.length ? ` Tiene ${e.overdue.length} cuota(s) vencida(s).` : ''}`, figure: e.actualBalance, transactionIds: loan.payments.map((p) => p.transactionId).filter(Boolean), link: { label: 'Ver crédito', to: `/creditos/${loan.id}` } }
  }
  if (/vencid/.test(q) && /cuota/.test(q)) {
    const dueSoon = s.loans.filter((c) => v.has(c.entityId)).flatMap((c) => loanStatus(c, s.today).overdue.map((f) => `${c.name}: cuota ${f.number} de ${formatCOP(f.total)}, venció el ${formatDate(f.date)}`))
    return { text: dueSoon.length ? `Hay ${dueSoon.length} cuota(s) vencida(s):\n• ${dueSoon.join('\n• ')}` : 'No hay cuotas vencidas.', link: { label: 'Ver créditos', to: '/creditos' } }
  }
  if (/soporte/.test(q)) {
    const ids = s.transactions.filter((h) => isTransactionVisible(h, v) && !h.attachmentIds.length).map((h) => h.id)
    return { text: `${ids.length} movimientos aprobados no tienen soporte adjunto.`, figure: ids.length, transactionIds: ids }
  }
  if (/plata|disponible|saldo/.test(q)) {
    const e = entitiesIn(q)[0]
    const scope: Scope = e ? { type: 'entity', entityId: e.id } : { type: 'group', includePersonal: false }
    const r = computeKpis(ls, scope, ctx, undefined, s.today)
    return { text: `${e ? e.name : 'El grupo (sin asuntos personales)'} tiene ${formatCOP(r.cashBalance.value)} en caja y bancos al ${formatDate(s.today)}.`, figure: r.cashBalance.value, transactionIds: transactionIds(r.cashBalance.lines) }
  }
  const pry = s.projects.find((p) => v.has(p.entityId) && [p.name, ...p.alias].some((a) => q.includes(normalizeText(a))))
  if (pry && /invert|inversion/.test(q)) {
    const r = computeKpis(ls, { type: 'project', projectId: pry.id }, ctx, range[0], range[1])
    return { text: `En el proyecto ${pry.name} se han invertido ${formatCOP(r.projectInvestment.value)}${month ? ` en ${formatMonth(month)}` : ''}.`, figure: r.projectInvestment.value, transactionIds: transactionIds(r.projectInvestment.lines) }
  }
  if (/resultado|utilidad|gane|ganancia/.test(q)) {
    const e = entitiesIn(q)[0]
    const scope: Scope = e ? { type: 'entity', entityId: e.id } : { type: 'group', includePersonal: false }
    const r = computeKpis(ls, scope, ctx, range[0], range[1])
    return { text: `El resultado final de ${e?.name ?? 'el grupo'}${month ? ` en ${formatMonth(month)}` : ' a la fecha'} es ${formatCOP(r.netResult.value)} (ingresos ${formatCOP(r.revenue.value)}, base caja).`, figure: r.netResult.value, transactionIds: transactionIds(r.netResult.lines) }
  }
  if (/gast|pag|cost|ingres|vend/.test(q)) {
    const cat = s.categories.find((c) => [c.name, ...c.alias].some((a) => q.includes(normalizeText(a))))
    if (!cat && !/ingres|vend/.test(q)) return NO_DATA
    const e = entitiesIn(q)[0]
    const ids = new Set(s.transactions.filter((h) => (cat ? h.categoryId === cat.id : true)).map((h) => h.id))
    const scope: Scope = e ? { type: 'entity', entityId: e.id } : { type: 'group', includePersonal: true }
    const r = computeKpis(ls, scope, ctx, range[0], range[1])
    const base = cat ? r.netResult.lines.filter((l) => ids.has(l.transactionId)) : r.revenue.lines
    if (!base.length) return { text: `No tengo movimientos aprobados de ${cat?.name.toLowerCase() ?? 'revenue'}${month ? ` en ${formatMonth(month)}` : ''}.` }
    const total = Math.abs(base.reduce((x, l) => x + l.amount, 0))
    return { text: `${cat ? `En ${cat.name.toLowerCase()} se ${cat.kind === 'income' ? 'recibieron' : 'gastaron'}` : 'Los ingresos fueron'} ${formatCOP(total)}${month ? ` en ${formatMonth(month)}` : ''}${e ? ` (${e.name})` : ''}, en ${transactionIds(base).length} movimientos.`, figure: total, transactionIds: transactionIds(base) }
  }
  return NO_DATA
}

export const chat = {
  suggested: () => Promise.resolve(SUGGESTED_QUESTIONS),
  ask: (question: string) => delay(() => answer(question), 500, 1100),
}

// Para el rango del periodo en pantallas.
export const util = { endOfMonth, inRange }
