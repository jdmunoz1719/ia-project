import { daysBetween } from '@/domain/schedule'
import { debtBetween, expandTransaction, intercompanyMatrix } from '@/domain/ledger'
import type { ProposalFields, Transaction, LedgerLine, Attachment, TransactionType } from '@/domain/types'
import { formatCOP } from '@/lib/format'
import {
  nowIso, delay, requirePermission, requireOpenMonth, get, isTransactionVisible, visibleLines, isMonthLocked, accountName,
  entityName, audit, set, uid, visibleEntityIds,
} from './base'

export const TYPE_NAME: Record<TransactionType | 'task', string> = {
  income: 'Ingreso', cost: 'Costo', expense: 'Gasto', interest: 'Interés / cargo', project_investment: 'Inversión en proyecto',
  transfer: 'Traslado', intercompany_payment: 'Pago entre empresas', loan_disbursement: 'Desembolso de crédito',
  loan_payment: 'Pago de crédito', task: 'Tarea',
}

const INFLOW_TYPES: TransactionType[] = ['income', 'loan_disbursement']
const TWO_ACCOUNT_TYPES: TransactionType[] = ['transfer', 'intercompany_payment']

/** Valida y completa los campos de un hecho. Devuelve los errores en español. */
export function validateFields(type: TransactionType, c: ProposalFields): { transaction?: Omit<Transaction, 'id' | 'approvedBy' | 'approvedAt' | 'attachmentIds'>; errors: string[] } {
  const e: string[] = []
  const s = get()
  if (!c.amount || c.amount <= 0) e.push('Falta el monto')
  if (!c.date) e.push('Falta la fecha')
  const movementAccount = INFLOW_TYPES.includes(type) ? c.destinationAccountId : c.sourceAccountId
  const payerEntity = (movementAccount && s.accounts.find((x) => x.id === movementAccount)?.entityId) || c.payerEntityId
  if (!payerEntity) e.push('Falta la cuenta o la empresa que paga')
  if (TWO_ACCOUNT_TYPES.includes(type) && (!c.sourceAccountId || !c.destinationAccountId)) e.push('Indica la cuenta de origen y la de destino')
  let allocations = (c.allocations ?? []).filter((a) => a.entityId)
  if (TWO_ACCOUNT_TYPES.includes(type)) {
    const dest = s.accounts.find((x) => x.id === c.destinationAccountId)?.entityId
    allocations = dest ? [{ entityId: dest, amount: c.amount ?? 0 }] : allocations
  }
  if (!allocations.length) e.push('Indica a qué empresa pertenece')
  if (allocations.length === 1) allocations = [{ ...allocations[0], amount: c.amount ?? 0 }]
  const allocSum = allocations.reduce((x, a) => x + a.amount, 0)
  if (allocations.length > 1 && allocSum !== c.amount) e.push(`El reparto suma ${formatCOP(allocSum)} y el monto es ${formatCOP(c.amount ?? 0)}`)
  if (type === 'loan_payment' && c.loanPaymentBreakdown) {
    const d = c.loanPaymentBreakdown
    if (d.capital + d.interest + d.fees !== c.amount) e.push('Capital + interés + cargos debe ser igual al monto')
  }
  if (e.length) return { errors: e }
  return {
    errors: [],
    transaction: {
      type, date: c.date!, amount: c.amount!, description: c.description?.trim() || TYPE_NAME[type],
      sourceAccountId: INFLOW_TYPES.includes(type) ? undefined : c.sourceAccountId,
      destinationAccountId: INFLOW_TYPES.includes(type) || TWO_ACCOUNT_TYPES.includes(type) ? c.destinationAccountId : undefined,
      payerEntityId: payerEntity!, allocations,
      categoryId: c.categoryId, counterpartyId: c.counterpartyId, loanId: c.loanId, installmentNumber: c.installmentNumber,
      loanPaymentBreakdown: c.loanPaymentBreakdown, sourceInboxItemId: c.sourceInboxItemId,
    },
  }
}

/** Registra un hecho UNA sola vez y actualiza lo que dependa de él (créditos, obligaciones). */
export function createTransaction(type: TransactionType, fields: ProposalFields, attachmentIds: string[] = []): Transaction {
  requirePermission('approve')
  const { transaction, errors } = validateFields(type, fields)
  if (!transaction) throw new Error(errors.join(' · '))
  requireOpenMonth(transaction)
  const h: Transaction = { ...transaction, id: uid('h'), attachmentIds, approvedBy: get().session.user?.name ?? 'Administrador', approvedAt: nowIso() }

  set((s) => {
    const changes: Partial<typeof s> = { transactions: [...s.transactions, h].sort((a, b) => a.date.localeCompare(b.date)) }
    // Pago de crédito: queda en el historial de pagos del crédito.
    if (h.type === 'loan_payment' && h.loanId) {
      const d = h.loanPaymentBreakdown ?? { capital: h.amount, interest: 0, fees: 0 }
      changes.loans = s.loans.map((cr) => cr.id !== h.loanId ? cr : { ...cr, payments: [...cr.payments, { transactionId: h.id, installmentNumber: h.installmentNumber ?? 0, ...d, date: h.date }] })
    }
    // Obligación que coincide (misma empresa y categoría, ±10 días): queda cumplida.
    const ent = h.allocations[0]?.entityId
    changes.obligations = s.obligations.map((o) => {
      if (o.entityId !== ent || !h.categoryId || o.categoryId !== h.categoryId) return o
      if (o.fulfilled.some((x) => Math.abs(daysBetween(x.period, h.date)) <= 10)) return o
      return { ...o, fulfilled: [...o.fulfilled, { period: h.date, transactionId: h.id, date: h.date }] }
    })
    return changes
  })
  audit('Aprobó movimiento', `${TYPE_NAME[h.type]} ${formatCOP(h.amount)}`, `${h.description} · ${entityName(h.allocations[0]?.entityId)}`, h.sourceInboxItemId)
  return h
}

/** Frases legibles del efecto contable (vista previa antes de aprobar). */
export function describeEffect(type: TransactionType, fields: ProposalFields): { phrases: { text: string; tone: 'neutral' | 'ic' | 'outflow' | 'inflow' }[]; lines: LedgerLine[]; errors: string[] } {
  const { transaction, errors } = validateFields(type, fields)
  if (!transaction) return { phrases: [], lines: [], errors }
  const ls = expandTransaction({ ...transaction, id: 'previa', attachmentIds: [], approvedBy: '', approvedAt: '' }, get().accounts)
  const F: { text: string; tone: 'neutral' | 'ic' | 'outflow' | 'inflow' }[] = []
  for (const l of ls) {
    const e = entityName(l.entityId)
    if (l.concept === 'result') F.push({ text: l.amount < 0 ? `${l.resultClass === 'financial' ? 'Gasto financiero' : type === 'cost' ? 'Costo' : 'Gasto'} en ${e}${l.amount !== -transaction.amount ? ` (${formatCOP(-l.amount)})` : ''}` : `Ingreso en ${e}`, tone: 'neutral' })
    if (l.concept === 'cash') F.push({ text: `${l.amount < 0 ? 'Sale de' : 'Entra a'} ${accountName(l.accountId)} (${e})`, tone: l.amount < 0 ? 'outflow' : 'inflow' })
    if (l.concept === 'investment') F.push({ text: `Inversión en proyecto de ${e} (no es gasto)`, tone: 'neutral' })
    if (l.concept === 'loan') F.push({ text: l.amount > 0 ? `Sube la deuda del crédito de ${e}` : `Baja la deuda del crédito de ${e} en ${formatCOP(-l.amount)}`, tone: 'neutral' })
    if (l.concept === 'ic_payable') {
      F.push(l.amount > 0
        ? { text: `${e} quedará debiendo ${formatCOP(l.amount)} a ${entityName(l.counterpartId)}`, tone: 'ic' }
        : { text: `${e} abona ${formatCOP(-l.amount)} a lo que le debe a ${entityName(l.counterpartId)}`, tone: 'ic' })
    }
  }
  // Orden de lectura del pliego (Ejemplo 2): primero a quién pertenece, luego de dónde sale la plata, al final quién le debe a quién.
  const ORDER = { neutral: 0, outflow: 1, inflow: 1, ic: 2 }
  F.sort((a, b) => ORDER[a.tone] - ORDER[b.tone])
  return { phrases: F, lines: ls, errors: [] }
}

export type TransactionFilters = {
  entityId?: string; projectId?: string; accountId?: string; type?: TransactionType; from?: string; to?: string
  withoutAttachment?: boolean; ids?: string[]; text?: string
}
// Dirección de la plata para mostrar en listas: entra, sale o se mueve dentro del grupo.
export type Direction = 'in' | 'out' | 'internal'
export type TransactionRow = Transaction & { locked: boolean; intercompany: boolean; direction: Direction }
const directionOf = (h: Transaction): Direction => INFLOW_TYPES.includes(h.type) ? 'in' : TWO_ACCOUNT_TYPES.includes(h.type) ? 'internal' : 'out'

export const movements = {
  list: (f: TransactionFilters = {}) => delay((): TransactionRow[] => {
    const v = visibleEntityIds()
    const ids = f.ids && new Set(f.ids)
    const q = f.text?.toLowerCase()
    return get().transactions.filter((h) => isTransactionVisible(h, v)
      && (!ids || ids.has(h.id))
      && (!f.entityId || h.payerEntityId === f.entityId || h.allocations.some((a) => a.entityId === f.entityId))
      && (!f.projectId || h.allocations.some((a) => a.projectId === f.projectId))
      && (!f.accountId || h.sourceAccountId === f.accountId || h.destinationAccountId === f.accountId)
      && (!f.type || h.type === f.type)
      && (!f.from || h.date >= f.from) && (!f.to || h.date <= f.to)
      && (!f.withoutAttachment || h.attachmentIds.length === 0)
      && (!q || h.description.toLowerCase().includes(q)))
      .map((h) => ({ ...h, locked: isMonthLocked(h), intercompany: h.allocations.some((a) => a.entityId !== h.payerEntityId), direction: directionOf(h) }))
      .reverse()
  }),

  detail: (id: string) => delay(() => {
    const s = get()
    const h = s.transactions.find((x) => x.id === id)
    if (!h) throw new Error('Movimiento no encontrado')
    return {
      transaction: h, locked: isMonthLocked(h),
      lines: expandTransaction(h, s.accounts),
      attachments: h.attachmentIds.map((sid) => s.attachments.find((x) => x.id === sid)).filter(Boolean) as Attachment[],
      inboxItem: s.inbox.find((b) => b.proposals.some((p) => p.transactionId === h.id)),
    }
  }),

  update: (id: string, changes: Pick<Transaction, 'description'> & Partial<Pick<Transaction, 'categoryId' | 'counterpartyId' | 'date'>>) => delay(() => {
    requirePermission('edit')
    const h = get().transactions.find((x) => x.id === id)!
    requireOpenMonth(h)
    if (changes.date) requireOpenMonth({ ...h, date: changes.date })
    set((s) => ({ transactions: s.transactions.map((x) => (x.id === id ? { ...x, ...changes } : x)) }))
    audit('Editó movimiento', h.description, Object.keys(changes).join(', '))
  }),

  attachFile: (id: string, file: { name: string; mimeType: string; size: number; url?: string }) => delay(() => {
    requirePermission('upload')
    const att: Attachment = { id: uid('s'), name: file.name, mimeType: file.mimeType, size: file.size, mockUrl: file.url ?? '', receivedAt: nowIso(), channel: 'manual', hash: uid('hash') }
    set((s) => ({ attachments: [...s.attachments, att], transactions: s.transactions.map((h) => (h.id === id ? { ...h, attachmentIds: [...h.attachmentIds, att.id] } : h)) }))
    audit('Adjuntó soporte', file.name)
  }),

  attachment: (id: string) => delay(() => get().attachments.find((s) => s.id === id)),
}

export const intercompany = {
  matrix: () => delay(() => {
    const ents = get().entities.filter((e) => visibleEntityIds().has(e.id))
    const ls = visibleLines()
    const m = intercompanyMatrix(ls, ents.map((e) => e.id))
    const ids = ents.map((e) => e.id)
    // Totales por fila (lo que cada empresa debe) y por columna (lo que le deben), y la lista de deudas abiertas.
    const owes = Object.fromEntries(ids.map((d) => [d, ids.reduce((a, c) => a + m[d][c], 0)]))
    const owedTo = Object.fromEntries(ids.map((c) => [c, ids.reduce((a, d) => a + m[d][c], 0)]))
    const pairs = ids.flatMap((d) => ids.filter((c) => m[d][c] > 0).map((c) => ({ debtor: d, creditor: c, value: m[d][c] }))).sort((a, b) => b.value - a.value)
    const total = pairs.reduce((a, p) => a + p.value, 0)
    return { entities: ents, matrix: m, owes, owedTo, pairs, total }
  }),

  detail: (debtor: string, creditor: string) => delay(() => {
    const { value, lines } = debtBetween(visibleLines(), debtor, creditor)
    const transactions = get().transactions
    const rows = lines.map((l) => ({ line: l, transaction: transactions.find((h) => h.id === l.transactionId)!, effect: l.entityId === debtor ? l.amount : -l.amount }))
      .sort((a, b) => a.transaction.date.localeCompare(b.transaction.date))
    return { value, rows }
  }),

  recordRepayment: (p: { debtor: string; creditor: string; amount: number; date: string; sourceAccountId: string; destinationAccountId: string; description?: string }) => delay(() =>
    createTransaction('intercompany_payment', {
      date: p.date, amount: p.amount, sourceAccountId: p.sourceAccountId, destinationAccountId: p.destinationAccountId, payerEntityId: p.debtor,
      description: p.description || `Devolución de ${entityName(p.debtor)} a ${entityName(p.creditor)}`,
      allocations: [{ entityId: p.creditor, amount: p.amount }],
    })),
}
