// Utilidades compartidas por los servicios mock.
import { expandAll } from '@/domain/ledger'
import type { KpiContext } from '@/domain/kpis'
import type { Channel, Transaction, LedgerLine, Proposal, Role } from '@/domain/types'
import { useDemo, type DemoState } from '@/store/demo'

export const get = () => useDemo.getState()
export const set = (fn: (s: DemoState) => Partial<DemoState>) => useDemo.setState(fn)

/** Latencia simulada de red (200–600 ms). */
export const delay = <T>(value: T | (() => T), min = 200, max = 600): Promise<T> =>
  new Promise((ok, reject) => setTimeout(() => {
    try { ok(typeof value === 'function' ? (value as () => T)() : value) } catch (e) { reject(e) }
  }, min + Math.random() * (max - min)))

export const uid = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
export const nowIso = () => {
  // La hora es real; la fecha es la "hoy" de la demo.
  const d = new Date()
  return `${get().today}T${d.toTimeString().slice(0, 8)}`
}

export function audit(action: string, objectName: string, detail = '', ref?: string) {
  const user = get().session.user?.name ?? 'Sistema'
  set((s) => ({ history: [...s.history, { date: nowIso(), user, action, objectName, detail, ref }] }))
}

// ---------- Permisos ----------
// Nombres en español para mensajes e historial (los valores internos están en inglés).
export const ROLE_LABEL: Record<Role, string> = { admin: 'Administrador', assistant: 'Asistente', accountant: 'Contador' }
export const CHANNEL_LABEL: Record<Channel, string> = { manual: 'Carga manual', whatsapp: 'WhatsApp', whatsapp_export: 'Chat exportado de WhatsApp', email: 'Correo', drive: 'Google Drive' }

export type Permission = 'upload' | 'approve' | 'edit' | 'configure'
export const PERMISSIONS: Record<Role, Permission[]> = {
  admin: ['upload', 'approve', 'edit', 'configure'],
  assistant: ['upload'],
  accountant: [],
}
export function requirePermission(p: Permission) {
  const role = get().session.user?.role ?? 'admin'
  if (!PERMISSIONS[role].includes(p)) throw new Error(`Tu rol (${ROLE_LABEL[role]}) no permite esta acción`)
}
export function visibleEntityIds(): Set<string> {
  const u = get().session.user
  const all = get().entities.map((e) => e.id)
  return new Set(u?.role === 'accountant' && u.entityIds ? u.entityIds : all)
}
export const isTransactionVisible = (h: Transaction, v = visibleEntityIds()) => v.has(h.payerEntityId) || h.allocations.some((a) => v.has(a.entityId))

// ---------- Libro (memoizado por referencia) ----------
let cache: { transactions: Transaction[]; accounts: unknown; lines: LedgerLine[] } | null = null
export function lines(): LedgerLine[] {
  const s = get()
  if (!cache || cache.transactions !== s.transactions || cache.accounts !== s.accounts) cache = { transactions: s.transactions, accounts: s.accounts, lines: expandAll(s.transactions, s.accounts) }
  return cache.lines
}
export const visibleLines = () => { const v = visibleEntityIds(); return lines().filter((l) => v.has(l.entityId)) }

export const pending = (): Proposal[] => get().inbox.flatMap((b) => b.proposals.filter((p) => p.status === 'pending'))

export function context(): KpiContext {
  const s = get(); const v = visibleEntityIds()
  return {
    entities: s.entities.filter((e) => v.has(e.id)),
    accounts: s.accounts.filter((c) => v.has(c.entityId)),
    projects: s.projects.filter((p) => v.has(p.entityId)),
    pending: pending(),
  }
}

export const entityName = (id?: string) => get().entities.find((e) => e.id === id)?.name ?? '—'
export const accountName = (id?: string) => get().accounts.find((c) => c.id === id)?.bank ?? '—'

/** Un mes con cierre publicado bloquea los hechos de las cuentas (o entidades) cerradas. */
export function isMonthLocked(h: Pick<Transaction, 'date' | 'sourceAccountId' | 'destinationAccountId' | 'payerEntityId'>): boolean {
  const month = h.date.slice(0, 7)
  const monthCloses = get().monthCloses.filter((c) => c.month === month && c.status === 'published')
  const accountIds = [h.sourceAccountId, h.destinationAccountId].filter(Boolean)
  return monthCloses.some((c) => (accountIds.length ? accountIds.includes(c.accountId) : c.entityId === h.payerEntityId))
}
export function requireOpenMonth(h: Parameters<typeof isMonthLocked>[0]) {
  if (isMonthLocked(h)) throw new Error(`El mes ${h.date.slice(5, 7)}/${h.date.slice(0, 4)} tiene un cierre publicado. Reábrelo para registrar o editar movimientos.`)
}
