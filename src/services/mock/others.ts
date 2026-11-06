import { format, parseISO, subMonths } from 'date-fns'
import { occurrences } from '@/domain/schedule'
import { loanStatus, balanceSeries, amortizationSchedule } from '@/domain/amortization'
import { accountBalance } from '@/domain/ledger'
import type { Loan, Obligation, Role, Task } from '@/domain/types'
import { formatCOP, formatDate, formatMonth, formatPct } from '@/lib/format'
import { initialState, useDemo, type DemoState, type User } from '@/store/demo'
import { delay, requirePermission, get, lines, entityName, audit, set, uid, visibleEntityIds, ROLE_LABEL } from './base'
import { createTransaction } from './movements'

// ---------------- Créditos ----------------
export const loans = {
  list: () => delay(() => {
    const s = get(); const v = visibleEntityIds()
    return s.loans.filter((c) => v.has(c.entityId)).map((c) => {
      const e = loanStatus(c, s.today)
      return { loan: c, actualBalance: e.actualBalance, next: e.next, overdue: e.overdue.length, totalInstallment: e.totalInstallment, monthlyRate: e.monthlyRate, paidByNumber: e.rows.filter((f) => f.status === 'paid').length }
    })
  }),
  detail: (id: string) => delay(() => {
    const s = get()
    const c = s.loans.find((x) => x.id === id)
    if (!c) throw new Error('Crédito no encontrado')
    return { loan: c, ...loanStatus(c, s.today), series: balanceSeries(c, s.today), today: s.today }
  }),
  recordPayment: (id: string, p: { installmentNumber: number; date: string; capital: number; interest: number; fees: number; accountId: string }) => delay(() => {
    const c = get().loans.find((x) => x.id === id)!
    if (c.payments.some((x) => x.installmentNumber === p.installmentNumber && p.installmentNumber > 0)) throw new Error(`La cuota ${p.installmentNumber} ya está pagada`)
    return createTransaction('loan_payment', {
      date: p.date, amount: p.capital + p.interest + p.fees, sourceAccountId: p.accountId, description: `Cuota ${p.installmentNumber} ${c.name.toLowerCase()}`,
      allocations: [{ entityId: c.entityId, amount: p.capital + p.interest + p.fees }], loanId: id, installmentNumber: p.installmentNumber,
      categoryId: 'cat-financiero', loanPaymentBreakdown: { capital: p.capital, interest: p.interest, fees: p.fees },
    })
  }),
  recordDisbursement: (id: string, p: { date: string; amount: number; accountId: string }) => delay(() => {
    const c = get().loans.find((x) => x.id === id)!
    return createTransaction('loan_disbursement', { date: p.date, amount: p.amount, destinationAccountId: p.accountId, loanId: id, description: `Desembolso ${c.name.toLowerCase()}`, allocations: [{ entityId: c.entityId, amount: p.amount }] })
  }),
  changeTerms: (id: string, cb: { type: 'rate' | 'extra_payment'; value: number; date: string; note: string; accountId?: string }) => delay(() => {
    requirePermission('edit')
    const c = get().loans.find((x) => x.id === id)!
    if (cb.type === 'extra_payment') {
      createTransaction('loan_payment', { date: cb.date, amount: cb.value, sourceAccountId: cb.accountId ?? c.accountId, description: `Abono extraordinario a capital ${c.name.toLowerCase()}`, allocations: [{ entityId: c.entityId, amount: cb.value }], loanId: id, installmentNumber: 0, categoryId: 'cat-financiero', loanPaymentBreakdown: { capital: cb.value, interest: 0, fees: 0 } })
    }
    set((s) => ({ loans: s.loans.map((x) => (x.id === id ? { ...x, changes: [...x.changes, cb] } : x)) }))
    audit('Cambió condiciones del crédito', c.name, cb.type === 'rate' ? `Nueva tasa ${formatPct(cb.value, 2)} ${c.rate.type} desde ${formatDate(cb.date)}` : `Abono extra ${formatCOP(cb.value)} el ${formatDate(cb.date)}`)
  }),
  recordBankBalance: (id: string, p: { date: string; balance: number }) => delay(() => {
    requirePermission('edit')
    set((s) => ({ loans: s.loans.map((x) => (x.id === id ? { ...x, bankBalances: [...x.bankBalances, p] } : x)) }))
    audit('Anotó saldo del banco', get().loans.find((x) => x.id === id)!.name, `${formatCOP(p.balance)} al ${formatDate(p.date)}`)
  }),
  create: (c: Omit<Loan, 'id' | 'payments' | 'bankBalances' | 'changes'>) => delay(() => {
    requirePermission('edit')
    const created: Loan = { ...c, id: uid('cred'), payments: [], bankBalances: [], changes: [] }
    set((s) => ({ loans: [...s.loans, created] }))
    audit('Creó crédito', c.name, `${formatCOP(c.amount)} · ${c.installmentCount} cuotas`)
    return created.id
  }),
  simulate: (c: Pick<Loan, 'amount' | 'rate' | 'installmentCount' | 'firstDueDate' | 'feesPerInstallment'>) => Promise.resolve(amortizationSchedule(c)),
}

// ---------------- Cierres ----------------
export const monthCloses = {
  months: () => delay(() => { const h = get().today; return Array.from({ length: 6 }, (_, i) => format(subMonths(parseISO(h), i), 'yyyy-MM')) }),
  list: (month: string) => delay(() => {
    const s = get(); const v = visibleEntityIds()
    const end = format(new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0), 'yyyy-MM-dd')
    return s.accounts.filter((c) => v.has(c.entityId)).map((c) => {
      const monthClose = s.monthCloses.find((x) => x.accountId === c.id && x.month === month)
      const systemBalance = monthClose?.status === 'published' ? monthClose.systemBalance : accountBalance(c, lines(), end)
      const ext = monthClose?.statementBalance ?? null
      const difference = ext === null ? null : ext - systemBalance
      const explained = (monthClose?.differences ?? []).reduce((a, d) => a + d.amount, 0)
      return { account: c, monthClose, systemBalance, statementBalance: ext, difference, explained, unexplained: difference === null ? null : difference - explained, monthEnded: end < s.today }
    })
  }),
  save: (accountId: string, month: string, statementBalance: number, differences: { amount: number; explanation: string }[]) => delay(() => {
    requirePermission('edit')
    const c = get().accounts.find((x) => x.id === accountId)!
    set((s) => {
      const exists = s.monthCloses.find((x) => x.accountId === accountId && x.month === month)
      if (exists?.status === 'published') throw new Error('El cierre está publicado')
      const created = { id: exists?.id ?? uid('cierre'), entityId: c.entityId, accountId, month, systemBalance: 0, statementBalance, differences, status: 'open' as const, reopenings: exists?.reopenings ?? [] }
      return { monthCloses: exists ? s.monthCloses.map((x) => (x.id === exists.id ? { ...x, ...created } : x)) : [...s.monthCloses, created] }
    })
    audit('Guardó saldo del extracto', `${c.name} · ${formatMonth(month)}`, formatCOP(statementBalance))
  }),
  publish: (accountId: string, month: string) => delay(() => {
    requirePermission('edit')
    const s = get()
    const c = s.accounts.find((x) => x.id === accountId)!
    const end = format(new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0), 'yyyy-MM-dd')
    const monthClose = s.monthCloses.find((x) => x.accountId === accountId && x.month === month)
    if (!monthClose || monthClose.statementBalance === null) throw new Error('Ingresa primero el saldo del extracto')
    const systemBalance = accountBalance(c, lines(), end)
    const unexplained = monthClose.statementBalance - systemBalance - monthClose.differences.reduce((a, d) => a + d.amount, 0)
    if (unexplained !== 0) throw new Error(`Quedan ${formatCOP(unexplained)} sin explicar`)
    set((st) => ({ monthCloses: st.monthCloses.map((x) => (x.id === monthClose.id ? { ...x, systemBalance, status: 'published', publishedAt: `${st.today}T12:00:00` } : x)) }))
    audit('Publicó cierre', `${c.name} · ${formatMonth(month)}`, `Saldo ${formatCOP(systemBalance)} · mes bloqueado`)
  }),
  reopen: (accountId: string, month: string, reason: string) => delay(() => {
    requirePermission('edit')
    if (reason.trim().length < 10) throw new Error('Escribe un motivo de al menos 10 caracteres')
    const s = get()
    const user = s.session.user?.name ?? 'Administrador'
    set((st) => ({ monthCloses: st.monthCloses.map((x) => (x.accountId === accountId && x.month === month ? { ...x, status: 'open', reopenings: [...x.reopenings, { date: `${st.today}T12:00:00`, reason, user }] } : x)) }))
    audit('Reabrió cierre', `${s.accounts.find((c) => c.id === accountId)!.name} · ${formatMonth(month)}`, `Motivo: ${reason}`)
  }),
}

// ---------------- Agenda ----------------
export const agenda = {
  occurrences: (from: string, to: string) => delay(() => {
    const s = get(); const v = visibleEntityIds()
    return occurrences(s.obligations.filter((o) => v.has(o.entityId)), from, to, s.today).map((o) => ({
      ...o, assignee: s.assignees.find((r) => r.id === o.obligation.assigneeId)?.name ?? '—',
    }))
  }),
  obligations: () => delay(() => get().obligations.filter((o) => visibleEntityIds().has(o.entityId))),
  recordPayment: (obligationId: string, period: string, p: { date: string; amount: number; accountId: string }) => delay(() => {
    const o = get().obligations.find((x) => x.id === obligationId)!
    const h = createTransaction('expense', { date: p.date, amount: p.amount, sourceAccountId: p.accountId, description: o.name, categoryId: o.categoryId, allocations: [{ entityId: o.entityId, amount: p.amount }] })
    set((s) => ({ obligations: s.obligations.map((x) => (x.id !== obligationId ? x : { ...x, fulfilled: [...x.fulfilled.filter((c) => c.transactionId !== h.id), { period, transactionId: h.id, date: p.date }] })) }))
    audit('Registró pago de obligación', o.name, `${formatCOP(p.amount)} · ${entityName(o.entityId)}`)
  }),
  saveObligation: (o: Omit<Obligation, 'id' | 'fulfilled'> & { id?: string }) => delay(() => {
    requirePermission('edit')
    set((s) => ({ obligations: o.id ? s.obligations.map((x) => (x.id === o.id ? { ...x, ...o } : x)) : [...s.obligations, { ...o, id: uid('ob'), fulfilled: [] }] }))
    audit(o.id ? 'Editó obligación' : 'Creó obligación', o.name, formatCOP(o.value))
  }),
  tasks: () => delay(() => get().tasks.filter((t) => !t.entityId || visibleEntityIds().has(t.entityId)).sort((a, b) => a.due.localeCompare(b.due))),
  createTask: (t: Omit<Task, 'id' | 'done'>) => delay(() => {
    requirePermission('upload')
    set((s) => ({ tasks: [...s.tasks, { ...t, id: uid('t'), done: false }] }))
    audit('Creó tarea', t.title, `Vence ${formatDate(t.due)}`)
  }),
  setTaskDone: (id: string, done: boolean) => delay(() => {
    requirePermission('upload')
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, done } : t)) }))
    audit(done ? 'Completó tarea' : 'Reabrió tarea', get().tasks.find((t) => t.id === id)!.title)
  }, 100, 250),
}

// ---------------- Configuración ----------------
type Collection = 'entities' | 'accounts' | 'projects' | 'categories' | 'counterparties' | 'assignees'
const COLLECTION_NAME: Record<Collection, string> = { entities: 'empresa', accounts: 'cuenta', projects: 'proyecto', categories: 'categoría', counterparties: 'tercero', assignees: 'responsable' }

export const settings = {
  get: () => delay(() => {
    const s = get(); const v = visibleEntityIds()
    return {
      entities: s.entities.filter((e) => v.has(e.id)), accounts: s.accounts.filter((c) => v.has(c.entityId)),
      projects: s.projects.filter((p) => v.has(p.entityId)), categories: s.categories, counterparties: s.counterparties, assignees: s.assignees,
      loans: s.loans.filter((c) => v.has(c.entityId)).map(({ id, name, entityId, bank, accountId }) => ({ id, name, entityId, bank, accountId })),
    }
  }, 100, 250),
  save: <C extends Collection>(col: C, item: DemoState[C][number]) => delay(() => {
    requirePermission('configure')
    const exists = (get()[col] as { id: string }[]).some((x) => x.id === item.id)
    const withId = { ...item, id: item.id || uid(col.slice(0, 3)) }
    set((s) => ({ [col]: exists ? (s[col] as { id: string }[]).map((x) => (x.id === item.id ? withId : x)) : [...s[col], withId] }) as Partial<DemoState>)
    audit(exists ? `Editó ${COLLECTION_NAME[col]}` : `Creó ${COLLECTION_NAME[col]}`, (item as { name: string }).name)
  }),
  remove: (col: Collection, id: string) => delay(() => {
    requirePermission('configure')
    const s = get()
    const inUse = s.transactions.some((h) => [h.sourceAccountId, h.destinationAccountId, h.payerEntityId, h.categoryId, h.counterpartyId, ...h.allocations.flatMap((a) => [a.entityId, a.projectId])].includes(id))
    if (inUse) throw new Error(`No se puede eliminar: hay movimientos que usan esta ${COLLECTION_NAME[col]}`)
    const name = (s[col] as { id: string; name: string }[]).find((x) => x.id === id)?.name ?? id
    set((st) => ({ [col]: (st[col] as { id: string }[]).filter((x) => x.id !== id) }) as Partial<DemoState>)
    audit(`Eliminó ${COLLECTION_NAME[col]}`, name)
  }),
  history: () => delay(() => [...get().history].reverse()),
  driveImport: (onProgress: (p: number, file: string) => void) => new Promise<{ found: number; loaded: number; skipped: number; failed: number; detail: { folder: string; files: number }[] }>((ok) => {
    const files = ['Empresa A/2026/10/Facturas/factura-ferreteria-3381.pdf', 'Empresa A/2026/10/Recibos/recibo-arriendo.jpg', 'Empresa B/2026/10/Extractos/extracto-bancolombia.xlsx', 'Empresa C/2026/10/Contratos/acta-obra-12.pdf', 'Empresa D/2026/10/Facturas/factura-epm.pdf', 'Empresa E/2026/10/Recibos/canon-local-104.jpg', 'Asuntos personales/2026/10/Recibos/colegio.pdf']
    let i = 0
    const t = setInterval(() => {
      i++
      onProgress(Math.min(100, Math.round((i / 40) * 100)), files[i % files.length])
      if (i >= 40) {
        clearInterval(t)
        const r = { found: 147, loaded: 131, skipped: 13, failed: 3, detail: [{ folder: 'Empresa A', files: 38 }, { folder: 'Empresa B', files: 41 }, { folder: 'Empresa C', files: 29 }, { folder: 'Empresa D', files: 17 }, { folder: 'Empresa E', files: 12 }, { folder: 'Asuntos personales', files: 10 }] }
        audit('Carga inicial desde Google Drive', 'Google Drive', `${r.found} encontrados, ${r.loaded} cargados, ${r.skipped} omitidos (duplicados), ${r.failed} fallidos`)
        ok(r)
      }
    }, 90)
  }),
}

// ---------------- Sesión (simulada: sin backend ni login real) ----------------
export const DEMO_USERS: User[] = [
  { name: 'Laura Restrepo', email: 'laura@grupo-demo.co', role: 'admin' },
  { name: 'Camila Ortiz', email: 'camila@grupo-demo.co', role: 'assistant' },
  { name: 'Carlos Mejía', email: 'carlos@contador-demo.co', role: 'accountant', entityIds: ['emp-a', 'emp-b'] },
]
export const DEMO_2FA_CODE = '246810'

export const session = {
  current: () => Promise.resolve({ ...get().session, today: get().today }),
  signIn: (email: string, password: string) => delay(() => {
    const u = DEMO_USERS.find((x) => x.email === email.trim().toLowerCase())
    if (!u || password.length < 4) throw new Error('Correo o contraseña incorrectos')
    set(() => ({ session: { user: u, verified: false } }))
    return u
  }, 400, 700),
  verify: (code: string) => delay(() => {
    if (code !== DEMO_2FA_CODE) throw new Error('Código incorrecto')
    set((s) => ({ session: { ...s.session, verified: true } }))
    audit('Inició sesión', 'Sesión', 'Verificación en dos pasos')
  }, 400, 700),
  close: () => delay(() => { audit('Cerró sesión', 'Sesión'); set(() => ({ session: { user: null, verified: false } })) }, 100, 200),
  switchRole: (role: Role) => delay(() => {
    const u = DEMO_USERS.find((x) => x.role === role)!
    set(() => ({ session: { user: u, verified: true } }))
    audit('Cambió de usuario (demo)', u.name, ROLE_LABEL[role])
  }, 100, 200),
  setToday: (date: string) => delay(() => { set(() => ({ today: date })); audit('Cambió la fecha de la demo', formatDate(date)) }, 100, 200),
  resetDemo: () => delay(() => {
    const ses = get().session
    useDemo.setState({ ...initialState(), session: ses })
  }, 300, 500),
}
