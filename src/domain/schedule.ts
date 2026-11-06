// Obligaciones recurrentes, alertas y vencimientos.
import { addDays, differenceInCalendarDays, format, lastDayOfMonth, parseISO } from 'date-fns'
import { loanStatus } from './amortization'
import type { Loan, Transaction, Obligation, Proposal, Task } from './types'

const iso = (d: Date) => format(d, 'yyyy-MM-dd')
export const addDaysIso = (date: string, days: number) => iso(addDays(parseISO(date), days))
export const daysBetween = (a: string, b: string) => differenceInCalendarDays(parseISO(b), parseISO(a))

export type Occurrence = {
  obligation: Obligation; date: string; status: 'fulfilled' | 'overdue' | 'pending'; transactionId?: string
}

function datesInRange(o: Obligation, from: string, to: string): string[] {
  if (o.recurrence === 'once') return o.date && o.date >= from && o.date <= to ? [o.date] : []
  const out: string[] = []
  const d0 = parseISO(from.slice(0, 7) + '-01')
  for (let m = new Date(d0); iso(m) <= to; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
    const ym = format(m, 'yyyy-MM')
    const lastDay = Number(format(lastDayOfMonth(m), 'dd'))
    const day = (d: number) => `${ym}-${String(Math.min(d, lastDay)).padStart(2, '0')}`
    if (o.recurrence === 'biweekly') out.push(day(15), day(30))
    else if (o.recurrence === 'monthly') out.push(day(o.dueDay ?? 1))
    else if (o.recurrence === 'bimonthly' && m.getMonth() % 2 === 0) out.push(day(o.dueDay ?? 1))
    else if (o.recurrence === 'yearly' && o.date && Number(o.date.slice(5, 7)) === m.getMonth() + 1) out.push(day(Number(o.date.slice(8, 10))))
  }
  return out.filter((f) => f >= from && f <= to)
}

export function occurrences(obligations: Obligation[], from: string, to: string, today: string): Occurrence[] {
  return obligations.flatMap((o) => datesInRange(o, from, to).map((date): Occurrence => {
    const c = o.fulfilled.find((x) => Math.abs(daysBetween(x.period, date)) <= 5)
    return { obligation: o, date, status: c ? 'fulfilled' : date < today ? 'overdue' : 'pending', transactionId: c?.transactionId }
  })).sort((a, b) => a.date.localeCompare(b.date))
}

export type Alert = {
  id: string; level: 'red' | 'amber'; title: string; detail: string; date: string
  entityId?: string; link: string; amount?: number
}

export function computeAlerts(p: {
  today: string; loans: Loan[]; obligations: Obligation[]; tasks: Task[]; transactions: Transaction[]
  snoozed: Record<string, string>; entityName: (id: string) => string
}): Alert[] {
  const { today } = p
  const A: Alert[] = []
  for (const c of p.loans) {
    const e = loanStatus(c, today)
    for (const f of e.overdue) A.push({ id: `cuota-${c.id}-${f.number}`, level: 'red', title: `Cuota ${f.number} vencida · ${c.name}`, detail: `${p.entityName(c.entityId)} · ${c.bank} · venció hace ${daysBetween(f.date, today)} días`, date: f.date, entityId: c.entityId, link: `/creditos/${c.id}`, amount: f.total })
    if (e.next && e.next.status === 'upcoming' && daysBetween(today, e.next.date) <= 7)
      A.push({ id: `cuota-${c.id}-${e.next.number}`, level: 'amber', title: `Cuota ${e.next.number} próxima · ${c.name}`, detail: `${p.entityName(c.entityId)} · vence en ${daysBetween(today, e.next.date)} días`, date: e.next.date, entityId: c.entityId, link: `/creditos/${c.id}`, amount: e.next.total })
  }
  for (const o of occurrences(p.obligations, addDaysIso(today, -30), addDaysIso(today, 7), today)) {
    if (o.status === 'fulfilled') continue
    const overdue = o.status === 'overdue'
    A.push({ id: `ob-${o.obligation.id}-${o.date}`, level: overdue ? 'red' : 'amber', title: `${o.obligation.name} ${overdue ? 'vencido' : 'por vencer'}`, detail: `${p.entityName(o.obligation.entityId)} · ${overdue ? `venció hace ${daysBetween(o.date, today)} días` : `vence en ${daysBetween(today, o.date)} días`}`, date: o.date, entityId: o.obligation.entityId, link: '/agenda', amount: o.obligation.value })
  }
  for (const t of p.tasks) {
    if (t.done) continue
    const d = daysBetween(today, t.due)
    if (d <= 2) A.push({ id: `tarea-${t.id}`, level: d < 0 ? 'red' : 'amber', title: t.title, detail: d < 0 ? `Tarea vencida hace ${-d} días` : d === 0 ? 'Tarea para hoy' : `Tarea para ${d === 1 ? 'mañana' : `dentro de ${d} días`}`, date: t.due, entityId: t.entityId, link: '/agenda' })
  }
  const withoutAttachment = p.transactions.filter((h) => h.attachmentIds.length === 0 && h.date >= addDaysIso(today, -30)).length
  if (withoutAttachment) A.push({ id: `sinsoporte-${today.slice(0, 7)}`, level: 'amber', title: `${withoutAttachment} movimientos sin soporte`, detail: 'Últimos 30 días · adjunta el comprobante', date: today, link: '/movimientos?sinSoporte=1' })

  return A.filter((a) => !(p.snoozed[a.id] && p.snoozed[a.id] > today))
    .sort((a, b) => (a.level === b.level ? a.date.localeCompare(b.date) : a.level === 'red' ? -1 : 1))
}

export type DueItem = { date: string; title: string; detail: string; amount?: number; type: 'obligation' | 'installment' | 'task'; link: string; overdue: boolean }

export function dueItems(p: { today: string; days: number; loans: Loan[]; obligations: Obligation[]; tasks: Task[]; entityName: (id: string) => string }): DueItem[] {
  const to = addDaysIso(p.today, p.days)
  const V: DueItem[] = []
  for (const o of occurrences(p.obligations, p.today, to, p.today)) if (o.status !== 'fulfilled')
    V.push({ date: o.date, title: o.obligation.name, detail: p.entityName(o.obligation.entityId), amount: o.obligation.value, type: 'obligation', link: '/agenda', overdue: false })
  for (const c of p.loans) for (const f of loanStatus(c, p.today).rows)
    if (f.status !== 'paid' && f.date >= p.today && f.date <= to)
      V.push({ date: f.date, title: `Cuota ${f.number} · ${c.name}`, detail: `${p.entityName(c.entityId)} · ${c.bank}`, amount: f.total, type: 'installment', link: `/creditos/${c.id}`, overdue: false })
  for (const t of p.tasks) if (!t.done && t.due >= p.today && t.due <= to)
    V.push({ date: t.due, title: t.title, detail: t.entityId ? p.entityName(t.entityId) : 'Tarea', type: 'task', link: '/agenda', overdue: false })
  return V.sort((a, b) => a.date.localeCompare(b.date))
}

/** Pago parecido: mismo monto, misma entidad y fecha a ±3 días de un hecho aprobado. */
export function findDuplicate(p: Pick<Proposal, 'fields'>, transactions: Transaction[]): Transaction | undefined {
  const c = p.fields
  if (!c.amount || !c.date) return undefined
  const ents = new Set([c.payerEntityId, ...(c.allocations ?? []).map((a) => a.entityId)].filter(Boolean))
  return transactions.find((h) => h.amount === c.amount && Math.abs(daysBetween(h.date, c.date!)) <= 3 &&
    (ents.size === 0 || ents.has(h.payerEntityId) || h.allocations.some((a) => ents.has(a.entityId))))
}
