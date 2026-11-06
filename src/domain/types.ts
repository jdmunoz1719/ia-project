// Tipos de dominio. Montos en pesos enteros (COP), fechas ISO yyyy-mm-dd.

export type Entity = { id: string; name: string; alias: string[]; isPersonal: boolean; description?: string }
export type Account = {
  id: string; entityId: string; bank: string; name: string; alias: string[]
  openingBalance: number; openingBalanceDate: string
}
export type Project = { id: string; entityId: string; name: string; alias: string[] }
export type CategoryKind = 'income' | 'cost_of_sales' | 'operating_expense' | 'financial' | 'investment'
export type Category = { id: string; name: string; kind: CategoryKind; alias: string[] }
export type Counterparty = { id: string; name: string; alias: string[] }
export type Assignee = { id: string; name: string; position: string }

export type TransactionType =
  | 'income' | 'cost' | 'expense' | 'interest' | 'project_investment'
  | 'transfer' | 'intercompany_payment' | 'loan_disbursement' | 'loan_payment'

export type Allocation = { entityId: string; projectId?: string; amount: number }
export type PaymentBreakdown = { capital: number; interest: number; fees: number }

export type Transaction = {
  id: string; type: TransactionType; date: string; amount: number; description: string
  sourceAccountId?: string; destinationAccountId?: string
  payerEntityId: string
  allocations: Allocation[]
  categoryId?: string; counterpartyId?: string; loanId?: string
  installmentNumber?: number
  loanPaymentBreakdown?: PaymentBreakdown
  attachmentIds: string[]; sourceInboxItemId?: string
  approvedBy: string; approvedAt: string
}

export type LedgerConcept = 'cash' | 'result' | 'ic_receivable' | 'ic_payable' | 'loan' | 'investment'
export type ResultClass = 'income' | 'cost_of_sales' | 'operating_expense' | 'financial'

export type LedgerLine = {
  transactionId: string; date: string; entityId: string; concept: LedgerConcept; amount: number
  accountId?: string; projectId?: string; resultClass?: ResultClass
  counterpartId?: string // en líneas intercompañía: la otra entidad
}

export type Channel = 'manual' | 'whatsapp' | 'whatsapp_export' | 'email' | 'drive'
export type Attachment = {
  id: string; name: string; mimeType: string; size: number; bodyText?: string
  mockUrl: string; receivedAt: string; channel: Channel; hash: string
}

export type Evidence = { field: string; sourceText: string; start: number; end: number }
export type ProposalStatus = 'pending' | 'approved' | 'corrected' | 'discarded' | 'rejected' | 'duplicate'
export type ProposalFields = Partial<Omit<Transaction, 'id' | 'approvedBy' | 'approvedAt'>> & {
  taskTitle?: string; due?: string
}
export type Proposal = {
  id: string; type: TransactionType | 'task'; fields: ProposalFields
  confidence: number; evidence: Evidence[]; status: ProposalStatus
  possibleDuplicateOf?: string; transactionId?: string; note?: string
}
export type InboxItem = {
  id: string; attachmentId: string; status: 'pending' | 'processing' | 'reviewed'
  proposals: Proposal[]; receivedAt: string; channel: Channel
  extractedText?: string; isTranscript?: boolean; duplicateFileOf?: string; incoming?: boolean
}

export type RateType = 'EA' | 'MV'
export type LoanPayment = { transactionId: string; installmentNumber: number; capital: number; interest: number; fees: number; date: string }
export type LoanChange = { date: string; type: 'rate' | 'extra_payment'; value: number; note: string }
export type Loan = {
  id: string; name: string; bank: string; entityId: string; accountId?: string; amount: number
  rate: { value: number; type: RateType } // valor como fracción: 0,145 = 14,5 %
  installmentCount: number; firstDueDate: string; feesPerInstallment: number
  payments: LoanPayment[]; bankBalances: { date: string; balance: number }[]; changes: LoanChange[]
}

export type Recurrence = 'monthly' | 'biweekly' | 'bimonthly' | 'yearly' | 'once'
export type Obligation = {
  id: string; name: string; entityId: string; value: number
  dueDay?: number; date?: string; recurrence: Recurrence; assigneeId: string
  categoryId?: string
  fulfilled: { period: string; transactionId?: string; date: string }[] // periodo = fecha de vencimiento cumplida
}
export type Task = { id: string; title: string; due: string; entityId?: string; loanId?: string; sourceProposalId?: string; done: boolean }
export type MonthClose = {
  id: string; entityId: string; accountId: string; month: string
  systemBalance: number; statementBalance: number | null
  differences: { amount: number; explanation: string }[]
  status: 'open' | 'published'; reopenings: { date: string; reason: string; user: string }[]
  publishedAt?: string
}
export type AuditEvent = { date: string; user: string; action: string; objectName: string; detail: string; ref?: string }

export type Role = 'admin' | 'assistant' | 'accountant'
