import type { ProposalFields, ProposalStatus, InboxItem, Proposal, TransactionType } from '@/domain/types'
import { formatCOP } from '@/lib/format'
import { processIntake, aiLatency, type IntakeInput } from '@/services/ai'
import { extractWhatsAppChat, extractStatement, extractProposals } from '@/services/ai/extractor'
import { DEMO_FILES, INCOMING_MESSAGES } from '@/services/ai/presets'
import { nowIso, delay, requirePermission, get, audit, set, uid, CHANNEL_LABEL } from './base'
import { createTransaction, describeEffect, TYPE_NAME } from './movements'

const aiConfig = () => { const s = get(); return { entities: s.entities, accounts: s.accounts, projects: s.projects, categories: s.categories, counterparties: s.counterparties, loans: s.loans } }

function updateItem(itemId: string, fn: (i: InboxItem) => InboxItem) {
  set((s) => ({
    inbox: s.inbox.map((i) => {
      if (i.id !== itemId) return i
      const n = fn(i)
      const hasOpen = n.proposals.some((p) => p.status === 'pending')
      return { ...n, status: n.status === 'processing' ? 'processing' : hasOpen ? 'pending' : 'reviewed' }
    }),
  }))
}
const updateProposal = (itemId: string, proposalId: string, fn: (p: Proposal) => Proposal) =>
  updateItem(itemId, (i) => ({ ...i, proposals: i.proposals.map((p) => (p.id === proposalId ? fn(p) : p)) }))

/** Crea el ítem en estado "procesando" y, tras la latencia de la IA, llena las propuestas. */
function receiveInternal(e: IntakeInput, animate = false): string {
  const s = get()
  const { attachment, item } = processIntake(e, aiConfig(), { transactions: s.transactions, attachments: s.attachments })
  const pending = { ...item, status: 'processing' as const, proposals: [], incoming: animate }
  set((st) => ({ attachments: [...st.attachments, attachment], inbox: [pending, ...st.inbox] }))
  audit('Cargó a la bandeja', attachment.name, `Canal: ${CHANNEL_LABEL[e.channel]}`, item.id)
  setTimeout(() => {
    set((st) => ({ inbox: st.inbox.map((i) => (i.id === item.id ? { ...item } : i)) }))
    audit('IA propuso registros', attachment.name, `${item.proposals.length} propuesta(s)`, item.id)
  }, aiLatency())
  return item.id
}

export const inbox = {
  list: () => delay(() => {
    const s = get()
    return s.inbox.map((i) => ({ ...i, attachment: s.attachments.find((x) => x.id === i.attachmentId)! }))
  }),

  get: (id: string) => delay(() => {
    const s = get()
    const item = s.inbox.find((i) => i.id === id)
    if (!item) throw new Error('Elemento no encontrado')
    const original = item.duplicateFileOf ? s.inbox.find((b) => b.attachmentId === item.duplicateFileOf) : undefined
    return { item, attachment: s.attachments.find((x) => x.id === item.attachmentId)!, history: s.history.filter((h) => h.ref === id).reverse(), duplicateOriginal: original && { itemId: original.id, receivedAt: original.receivedAt } }
  }, 150, 300),

  receive: (e: IntakeInput) => delay(() => { requirePermission('upload'); return receiveInternal(e) }, 150, 300),

  demoFiles: () => delay(() => DEMO_FILES.map(({ name, description, mimeType, size, view }) => ({ name, description, mimeType, size, view }))),

  loadDemoFile: (name: string) => delay(() => {
    requirePermission('upload')
    const a = DEMO_FILES.find((x) => x.name === name)!
    return receiveInternal({ channel: a.channel, receivedAt: nowIso(), file: { name: a.name, mimeType: a.mimeType, size: a.size } })
  }, 150, 300),

  /** Simula un mensaje que llega solo por WhatsApp o correo conectado. */
  inject: (channel: 'whatsapp' | 'email') => delay(() => {
    const k = get().incomingCounters[channel]
    const list = INCOMING_MESSAGES[channel]
    const m = list[k % list.length]
    set((s) => ({ incomingCounters: { ...s.incomingCounters, [channel]: k + 1 } }))
    const text = 'subject' in m ? `${m.subject}\n\n${m.text}` : m.text
    return receiveInternal({ channel, receivedAt: nowIso(), sender: m.from, text }, true)
  }, 50, 100),

  effect: (type: TransactionType, fields: ProposalFields) => Promise.resolve(describeEffect(type, fields)),

  approve: (itemId: string, proposalId: string, fields: ProposalFields, type: TransactionType | 'task', corrected: boolean) => delay(() => {
    requirePermission('approve')
    const item = get().inbox.find((i) => i.id === itemId)!
    if (type === 'task') {
      if (!fields.taskTitle || !fields.due) throw new Error('La tarea necesita título y fecha de vencimiento')
      const t = { id: uid('t'), title: fields.taskTitle, due: fields.due, entityId: fields.allocations?.[0]?.entityId, loanId: fields.loanId, sourceProposalId: proposalId, done: false }
      set((s) => ({ tasks: [...s.tasks, t] }))
      updateProposal(itemId, proposalId, (p) => ({ ...p, type, fields, status: corrected ? 'corrected' : 'approved' }))
      audit('Aprobó tarea', t.title, `Vence ${t.due.split('-').reverse().join('/')}`, itemId)
      return { type: 'task' as const, id: t.id }
    }
    const h = createTransaction(type, { ...fields, sourceInboxItemId: itemId }, [item.attachmentId])
    updateProposal(itemId, proposalId, (p) => ({ ...p, type, fields, status: corrected ? 'corrected' : 'approved', transactionId: h.id }))
    return { type: 'transaction' as const, id: h.id }
  }),

  setStatus: (itemId: string, proposalId: string, status: Extract<ProposalStatus, 'discarded' | 'rejected' | 'duplicate' | 'pending'>) => delay(() => {
    requirePermission('approve')
    const p = get().inbox.find((i) => i.id === itemId)!.proposals.find((x) => x.id === proposalId)!
    updateProposal(itemId, proposalId, (x) => ({ ...x, status }))
    const verb = { discarded: 'Descartó', rejected: 'Rechazó', duplicate: 'Marcó como duplicado', pending: 'Reabrió' }[status]
    audit(`${verb} propuesta`, `${TYPE_NAME[p.type]}${p.fields.amount ? ' ' + formatCOP(p.fields.amount) : ''}`, '', itemId)
  }),

  reread: (itemId: string) => delay(() => {
    requirePermission('upload')
    const item = get().inbox.find((i) => i.id === itemId)!
    const a = DEMO_FILES.find((x) => x.name === get().attachments.find((s) => s.id === item.attachmentId)?.name)
    const t = item.extractedText ?? ''
    const fresh = a?.mode === 'chat' ? extractWhatsAppChat(t, aiConfig()) : a?.mode === 'statement' ? extractStatement(t, a.accountId!, aiConfig()) : extractProposals(t, item.receivedAt, aiConfig(), a?.options)
    updateItem(itemId, (i) => ({ ...i, status: 'processing', proposals: i.proposals.filter((p) => p.status !== 'pending') }))
    setTimeout(() => {
      set((s) => ({ inbox: s.inbox.map((i) => (i.id === itemId ? { ...i, status: 'pending', proposals: [...i.proposals, ...fresh] } : i)) }))
    }, aiLatency())
    audit('Volvió a leer con IA', a?.name ?? 'Mensaje', '', itemId)
  }),

  addManual: (itemId: string, type: 'registro' | 'task') => delay(() => {
    requirePermission('upload')
    const p: Proposal = { id: uid('p'), type: type === 'task' ? 'task' : 'expense', confidence: 100, evidence: [], status: 'pending', note: 'Agregado a mano', fields: { date: get().today, due: type === 'task' ? get().today : undefined, allocations: [] } }
    updateItem(itemId, (i) => ({ ...i, proposals: [...i.proposals, p] }))
    return p.id
  }, 100, 200),
}
