// Estado de la demo (Zustand + localStorage). Sólo lo usan los servicios mock, nunca las pantallas.
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import * as seed from '@/data/seed'
import { expandAll, accountBalance } from '@/domain/ledger'
import type {
  Category, MonthClose, Loan, Account, Entity, AuditEvent, Transaction, InboxItem, Obligation,
  Project, Assignee, Role, Attachment, Task, Counterparty,
} from '@/domain/types'
import { processIntake } from '@/services/ai'
import { DEMO_FILES } from '@/services/ai/presets'

export type User = { name: string; email: string; role: Role; entityIds?: string[] }

export type DemoState = {
  version: number
  today: string
  session: { user: User | null; verified: boolean }
  entities: Entity[]; accounts: Account[]; projects: Project[]; categories: Category[]
  counterparties: Counterparty[]; assignees: Assignee[]
  transactions: Transaction[]; attachments: Attachment[]; inbox: InboxItem[]
  loans: Loan[]; obligations: Obligation[]; tasks: Task[]; monthCloses: MonthClose[]
  history: AuditEvent[]; snoozed: Record<string, string>
  incomingCounters: { whatsapp: number; email: number }
}

export const DATA_VERSION = 5

export function initialState(): DemoState {
  const g = seed.generateSeed()
  const lines = expandAll(g.transactions, seed.accounts)
  const monthCloses = seed.septemberCloses((id) => accountBalance(seed.accounts.find((c) => c.id === id)!, lines, '2026-09-30'))
  const cfg = { ...seed, loans: g.loans }
  const attachments = [...g.attachments]
  const inbox: InboxItem[] = []
  for (const b of seed.initialInbox) {
    const demo = 'file' in b ? DEMO_FILES.find((a) => a.name === b.file) : undefined
    const { attachment, item } = processIntake({
      channel: b.channel, receivedAt: b.receivedAt, sender: b.name.replace('WhatsApp · ', ''),
      text: 'text' in b ? b.text : undefined,
      file: demo && { name: demo.name, mimeType: demo.mimeType, size: demo.size },
    }, cfg, { transactions: g.transactions, attachments })
    attachments.push(attachment); inbox.unshift(item)
  }
  return {
    version: DATA_VERSION, today: seed.DEMO_TODAY, session: { user: null, verified: false },
    entities: seed.entities, accounts: seed.accounts, projects: seed.projects, categories: seed.categories,
    counterparties: seed.counterparties, assignees: seed.assignees,
    transactions: g.transactions, attachments, inbox, loans: g.loans, obligations: g.obligations, tasks: g.tasks,
    monthCloses, history: g.history, snoozed: {}, incomingCounters: { whatsapp: 0, email: 0 },
  }
}

export const useDemo = create<DemoState>()(
  persist(() => initialState(), {
    name: 'caja-clara-demo',
    version: DATA_VERSION,
    migrate: () => initialState(),
  }),
)
