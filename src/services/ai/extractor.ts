// "IA simulada", capa 1: extractor por reglas sobre texto libre en español colombiano.
// Sólo asigna entidades, cuentas, proyectos, categorías y terceros que existan en la configuración.
import { addDays, addMonths, format, parseISO, subMonths } from 'date-fns'
import type { Category, Loan, Account, Entity, Evidence, Proposal, Project, Counterparty, TransactionType } from '@/domain/types'

export type AiConfig = {
  entities: Entity[]; accounts: Account[]; projects: Project[]; categories: Category[]
  counterparties: Counterparty[]; loans: Loan[]
}
export type AiOptions = {
  /** Trata todo el texto como un solo registro (recibos, facturas, correos). */
  singleRecord?: boolean
  /** Tipo conocido de antemano por el tipo de documento. */
  type?: TransactionType | 'task'
  taskTitle?: string
  /** Desplazamiento del texto dentro del original (para la evidencia). */
  offset?: number
}

let accountant = 0
const newId = () => `p-${Date.now().toString(36)}-${(accountant++).toString(36)}`

/** Minúsculas sin tildes, conservando la longitud (para que las posiciones coincidan con el original). */
export const normalizeText = (s: string) => Array.from(s, (ch) => ch.normalize('NFD').replace(/[̀-ͯ]/g, '') || ch).join('').toLowerCase()
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const wordRegex = (alias: string) => new RegExp(`(?<![a-z0-9])${esc(normalizeText(alias))}(?![a-z0-9])`, 'g')

type Match<T> = { item: T; start: number; end: number }
function findAliases<T extends { alias: string[]; name?: string }>(txt: string, items: T[], includeName = false): Match<T>[] {
  const out: Match<T>[] = []
  for (const item of items) {
    const alias = [...item.alias, ...(includeName && item.name ? [item.name] : [])]
    for (const a of alias) for (const m of txt.matchAll(wordRegex(a))) out.push({ item, start: m.index!, end: m.index! + m[0].length })
  }
  // Quita solapados dejando el más largo.
  out.sort((a, b) => (b.end - b.start) - (a.end - a.start))
  const chosen: Match<T>[] = []
  for (const h of out) if (!chosen.some((e) => h.start < e.end && e.start < h.end)) chosen.push(h)
  return chosen.sort((a, b) => a.start - b.start)
}

// ---------------- Montos ----------------
const RE_MILLIONS = /(\$\s?)?(\d{1,3}(?:[.,]\d{1,3})?)\s*(?:millones|millon|mill|palos)(?![a-z])/g
const RE_THOUSAND = /(\$\s?)?(\d{1,3})\s*mil(?![a-z])/g
const RE_DOTTED = /(\$\s?)?\d{1,3}(?:\.\d{3})+(?!\d)/g
const RE_DIGITS = /(\$\s?)?(?<![\d/])\d{4,9}(?![\d/])/g

type AmountHit = { value: number; start: number; end: number; preferred: boolean }
function findAmounts(t: string): AmountHit[] {
  const out: AmountHit[] = []
  const busy = (i: number, f: number) => out.some((m) => i < m.end && m.start < f)
  const preferredAt = (i: number, hasPesoSign: boolean) => hasPesoSign || /(total|valor|suma|por|de|pagar)\W{0,4}$/.test(t.slice(Math.max(0, i - 14), i))
  for (const m of t.matchAll(RE_MILLIONS)) { const v = Math.round(parseFloat(m[2].replace(',', '.')) * 1e6); out.push({ value: v, start: m.index!, end: m.index! + m[0].length, preferred: preferredAt(m.index!, !!m[1]) }) }
  for (const m of t.matchAll(RE_THOUSAND)) if (!busy(m.index!, m.index! + m[0].length)) out.push({ value: Number(m[2]) * 1000, start: m.index!, end: m.index! + m[0].length, preferred: preferredAt(m.index!, !!m[1]) })
  for (const m of t.matchAll(RE_DOTTED)) if (!busy(m.index!, m.index! + m[0].length)) out.push({ value: Number(m[0].replace(/[$\s.]/g, '')), start: m.index!, end: m.index! + m[0].length, preferred: preferredAt(m.index!, !!m[1]) })
  for (const m of t.matchAll(RE_DIGITS)) if (!busy(m.index!, m.index! + m[0].length)) out.push({ value: Number(m[0].replace(/[$\s]/g, '')), start: m.index!, end: m.index! + m[0].length, preferred: !!m[1] })
  return out.filter((m) => m.value >= 1000).sort((a, b) => a.start - b.start)
}

// ---------------- Fechas ----------------
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
type DateHit = { value: string; start: number; end: number }
const iso = (d: Date) => format(d, 'yyyy-MM-dd')

function findDate(t: string, received: string, future: boolean): DateHit | undefined {
  const base = parseISO(received)
  const candidates: DateHit[] = []
  const push = (m: RegExpMatchArray, d: Date) => candidates.push({ value: iso(d), start: m.index!, end: m.index! + m[0].length })
  for (const m of t.matchAll(/(?<!\d)(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?!\d)/g)) {
    const y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : base.getFullYear()
    const d = new Date(y, Number(m[2]) - 1, Number(m[1]))
    if (!isNaN(d.getTime()) && Number(m[2]) <= 12) push(m, d)
  }
  const rel: [RegExp, number][] = [[/pasado manana/g, 2], [/(?<!pasado )manana/g, 1], [/antier|anteayer/g, -2], [/(?<![a-z])ayer/g, -1], [/(?<![a-z])hoy(?![a-z])/g, 0]]
  for (const [re, d] of rel) for (const m of t.matchAll(re)) push(m, addDays(base, d))
  for (const m of t.matchAll(/(?:el|este|el pasado|el proximo)\s+(lunes|martes|miercoles|jueves|viernes|sabado|domingo)/g)) {
    const targetDay = WEEKDAYS.indexOf(m[1])
    let diff = targetDay - base.getDay()
    if (future) { if (diff <= 0) diff += 7 } else if (diff >= 0) diff -= 7
    push(m, addDays(base, diff))
  }
  for (const m of t.matchAll(/(?:el|el dia)\s+(\d{1,2})(?![\d/.,]|\s*(?:mil|millon|de\s+\w+\s+de))/g)) {
    const day = Number(m[1]); if (day < 1 || day > 31) continue
    let d = new Date(base.getFullYear(), base.getMonth(), day)
    if (future && day < base.getDate()) d = addMonths(d, 1)
    if (!future && day > base.getDate()) d = subMonths(d, 1)
    push(m, d)
  }
  return candidates.sort((a, b) => a.start - b.start)[0]
}

// ---------------- Tipo de movimiento ----------------
const TYPES: [RegExp, TransactionType | 'task'][] = [
  [/hay que|toca |tenemos que|recordar|no olvidar|pendiente pagar|fecha limite|vence el/, 'task'],
  [/cuota del credito|cuota del leasing|abone al credito|pague la cuota/, 'loan_payment'],
  [/(?<![a-z])(pase|traslade|traslado|movi)(?![a-z])/, 'transfer'],
  [/devolvi|le devolvio|devolucion a la empresa|le devolvimos/, 'intercompany_payment'],
  [/recibi|recibimos|nos consignaron|nos pagaron|cobre|entro|consignaron|abonaron|nos transfirieron/, 'income'],
  [/invertimos|inversion en|adecuacion/, 'project_investment'],
  [/pague|pago|gaste|compre|transferi|le consigne|cancele|salio|pagamos/, 'expense'],
]
const detectType = (t: string) => TYPES.find(([re]) => re.test(t))?.[1]

const KINDS_BY_TYPE: Record<string, string[]> = {
  income: ['income'], expense: ['operating_expense', 'cost_of_sales', 'financial'], cost: ['cost_of_sales'],
  interest: ['financial'], project_investment: ['investment'], task: ['operating_expense', 'cost_of_sales', 'financial'],
}

// ---------------- Segmentación ----------------
const VERB_CONNECTOR = '(?:pague|pago|gaste|recibi|nos consignaron|cobre|pase|traslade|hay que|toca|manana|tambien|compre|transferi)'
function segment(t: string): { start: number; end: number }[] {
  const cuts = [0]
  const re = new RegExp(`\\.(?=\\s|$)|[;\\n!?]|\\s(?:ademas|y luego|y tambien)\\s|\\sy\\s(?=${VERB_CONNECTOR})`, 'g')
  for (const m of t.matchAll(re)) cuts.push(m.index! + m[0].length)
  cuts.push(t.length)
  return cuts.slice(0, -1).map((c, i) => ({ start: c, end: cuts[i + 1] })).filter((s) => /[a-z0-9]/.test(t.slice(s.start, s.end)))
}

function taskTitleFrom(original: string): string {
  const s = original.trim().replace(/^[\s,.-]+|[\s.]+$/g, '')
  const m = normalizeText(s).match(/(hay que|toca|tenemos que|recordar|no olvidar)\s+/)
  let r = m ? s.slice(m.index! + m[0].length) : s
  r = r.replace(/^(\p{L}+)\s+(la|el|los|las)\s+/u, '$1 ')
  r = r.replace(/\s+(manana|mañana|pasado mañana|el \d{1,2}|el (lunes|martes|miércoles|jueves|viernes|sábado|domingo))$/i, '')
  return r.charAt(0).toUpperCase() + r.slice(1)
}

/** Extrae propuestas de un texto. `recibido` es la fecha ISO de recepción (base para "ayer", "mañana"…). */
export function extractProposals(text: string, received: string, cfg: AiConfig, op: AiOptions = {}): Proposal[] {
  const off = op.offset ?? 0
  const N = normalizeText(text)
  const segments = op.singleRecord ? [{ start: 0, end: text.length }] : segment(N)
  const out: Proposal[] = []

  for (const seg of segments) {
    const t = N.slice(seg.start, seg.end)
    const detectedType = op.type ?? detectType(t)
    const amounts = findAmounts(t.replace(/(nit|no\.|nro\.?|factura|fe-|ref\.?)[\s:#]*[\w.-]+/g, (x) => ' '.repeat(x.length)))
    const loan = cfg.loans.find((c) => {
      const n = normalizeText(c.name); return t.includes(n) || t.includes(n.replace(/^credito\s+/, ''))
    })
    if (!detectedType && amounts.length === 0 && !loan) continue
    const type: TransactionType | 'task' = detectedType ?? 'expense'
    const isTask = type === 'task'

    const ev: Evidence[] = []
    const addEvidence = (field: string, i: number, f: number) => ev.push({ field, sourceText: text.slice(seg.start + i, seg.start + f), start: off + seg.start + i, end: off + seg.start + f })
    let confidence = 95
    const notes: string[] = []
    if (!detectedType) { confidence -= 15; notes.push('No se reconoció el tipo de movimiento') }

    // Monto
    const amount = amounts.find((m) => m.preferred) ?? amounts[0]
    if (amount) addEvidence('amount', amount.start, amount.end)

    // Fecha
    const date = findDate(t, received.slice(0, 10), isTask)
    if (date) addEvidence(isTask ? 'due' : 'date', date.start, date.end)

    // Cuentas, entidades, proyectos, terceros, categorías
    const accountHits = findAliases(t, cfg.accounts)
    const entityHits = findAliases(t, cfg.entities, true)
    const projectHits = findAliases(t, cfg.projects)
    const counterpartyHits = findAliases(t, cfg.counterparties)
    const allowedKinds = KINDS_BY_TYPE[type] ?? []
    const categoryHits = findAliases(t, cfg.categories.filter((c) => allowedKinds.includes(c.kind)))

    // Entidades pegadas a una cuenta ("Bancolombia de la Empresa B") = dueña de la cuenta.
    const entityOfAccount = (h: Match<Account>) => entityHits.find((e) => e.start >= h.end && e.start - h.end <= 12)
    const resolveAccount = (h: Match<Account>) => {
      const sameAlias = cfg.accounts.filter((c) => c.alias.some((a) => normalizeText(a) === normalizeText(text.slice(seg.start + h.start, seg.start + h.end))))
      const attached = entityOfAccount(h)
      if (sameAlias.length > 1) {
        const r = attached && sameAlias.find((c) => c.entityId === attached.item.id)
        if (!r) { confidence -= 10; notes.push('La cuenta mencionada es ambigua') }
        return r
      }
      if (attached && attached.item.id !== h.item.entityId) { confidence -= 10; notes.push(`${h.item.name} no pertenece a ${attached.item.name}`) }
      return h.item
    }
    const resolvedAccounts = accountHits.map((h) => ({ h, account: resolveAccount(h) }))
    const sourceAccount = resolvedAccounts[0]
    const destAccount = type === 'transfer' || type === 'intercompany_payment' ? resolvedAccounts[1] : undefined
    for (const [i, c] of [sourceAccount, destAccount].entries()) if (c?.account) addEvidence(i === 0 && type !== 'income' ? 'sourceAccountId' : 'destinationAccountId', c.h.start, c.h.end)

    const attachedEntities = new Set(resolvedAccounts.map((c) => entityOfAccount(c.h)).filter(Boolean))
    const freeEntity = entityHits.find((e) => !attachedEntities.has(e))
    const project = projectHits[0]
    if (project) addEvidence('projectId', project.start, project.end)
    const counterparty = counterpartyHits[0]
    if (counterparty) addEvidence('counterpartyId', counterparty.start, counterparty.end)
    const category = categoryHits[0]
    if (category) addEvidence('categoryId', category.start, category.end)

    const mainAccount = sourceAccount?.account
    const payerEntity = mainAccount?.entityId ?? freeEntity?.item.id ?? project?.item.entityId ?? loan?.entityId
    const owner = (type === 'transfer' || type === 'intercompany_payment')
      ? destAccount?.account?.entityId ?? freeEntity?.item.id
      : project?.item.entityId ?? freeEntity?.item.id ?? loan?.entityId ?? payerEntity
    for (const e of entityHits) addEvidence(attachedEntities.has(e) ? 'payerEntityId' : 'entityId', e.start, e.end)

    // Confianza: −20 por cada campo clave faltante, −5 si la fecha se toma de la recepción.
    if (!amount && !isTask) { confidence -= 20; notes.push('Falta el monto') }
    if (!date) { confidence -= isTask ? 20 : 5; notes.push(isTask ? 'Falta la fecha de vencimiento' : 'Fecha tomada de la recepción') }
    if (!owner && !isTask) { confidence -= 20; notes.push('No se identificó la empresa') }
    if (amounts.length > 1 && !amounts.some((m) => m.preferred)) { confidence -= 10; notes.push('Hay varios montos en el texto') }

    const finalDate = date?.value ?? received.slice(0, 10)
    const finalType: TransactionType | 'task' = type === 'expense' && category?.item.kind === 'cost_of_sales' ? 'cost' : type === 'expense' && category?.item.kind === 'financial' && !loan ? 'interest' : type
    const p: Proposal = {
      id: newId(), type: finalType, confidence: Math.max(5, Math.min(99, confidence)), evidence: ev, status: 'pending',
      note: notes.join(' · ') || undefined,
      fields: isTask
        ? { taskTitle: op.taskTitle ?? taskTitleFrom(text.slice(seg.start, seg.end)), due: date?.value, loanId: loan?.id, amount: amount?.value,
            allocations: owner ? [{ entityId: owner, amount: amount?.value ?? 0 }] : [], payerEntityId: payerEntity, categoryId: category?.item.id, description: text.slice(seg.start, seg.end).trim() }
        : {
            date: finalDate, amount: amount?.value, description: text.slice(seg.start, seg.end).trim().replace(/[.\s]+$/, ''),
            payerEntityId: payerEntity,
            sourceAccountId: type === 'income' || type === 'loan_disbursement' ? undefined : mainAccount?.id,
            destinationAccountId: type === 'income' || type === 'loan_disbursement' ? mainAccount?.id : destAccount?.account?.id,
            allocations: owner ? [{ entityId: owner, projectId: project && project.item.entityId === owner ? project.item.id : undefined, amount: amount?.value ?? 0 }] : [],
            categoryId: category?.item.id ?? (type === 'loan_payment' ? 'cat-financiero' : undefined),
            counterpartyId: counterparty?.item.id, loanId: loan?.id,
          },
    }
    out.push(p)
  }

  if (out.length === 0) out.push(emptyProposal(received, 'No se encontraron registros en el contenido'))
  return out
}

export function emptyProposal(received: string, note = 'La IA no reconoció este archivo. Completa los campos.'): Proposal {
  return { id: newId(), type: 'expense', confidence: 15, evidence: [], status: 'pending', note, fields: { date: received.slice(0, 10), allocations: [] } }
}

/** Chat exportado de WhatsApp: "dd/mm/aa, h:mm a. m. - Nombre: mensaje". Cada mensaje usa su propia fecha. */
export function extractWhatsAppChat(text: string, cfg: AiConfig): Proposal[] {
  const out: Proposal[] = []
  const re = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s[^-\n]+-\s[^:\n]+:\s(.*)$/gm
  for (const m of text.matchAll(re)) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3]
    const date = `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
    const msg = m[4]
    const off = m.index! + m[0].length - msg.length
    const ps = extractProposals(msg, date, cfg, { offset: off })
    out.push(...ps.filter((p) => p.confidence > 15))
  }
  return out.length ? out : [emptyProposal(new Date().toISOString())]
}

/** Extracto bancario: filas "dd/mm/aaaa  DESCRIPCIÓN  ±valor". */
export function extractStatement(text: string, accountId: string, cfg: AiConfig): Proposal[] {
  const account = cfg.accounts.find((c) => c.id === accountId)!
  const out: Proposal[] = []
  for (const m of text.matchAll(/^(\d{2})\/(\d{2})\/(\d{4})\s+(.+?)\s+([+-])\$?\s?([\d.]+)$/gm)) {
    const date = `${m[3]}-${m[2]}-${m[1]}`
    const desc = m[4].trim()
    const value = Number(m[6].replace(/\./g, ''))
    const inflow = m[5] === '+'
    const nd = normalizeText(desc)
    const i0 = m.index!
    const ev: Evidence[] = [
      { field: 'date', sourceText: m[0].slice(0, 10), start: i0, end: i0 + 10 },
      { field: 'amount', sourceText: m[5] + m[6], start: i0 + m[0].length - m[6].length - 1, end: i0 + m[0].length },
    ]
    const descStart = i0 + m[0].indexOf(m[4])
    ev.push({ field: 'description', sourceText: desc, start: descStart, end: descStart + desc.length })
    const otherEntity = cfg.entities.find((e) => e.alias.some((a) => nd.includes(normalizeText(a)) || nd.includes(normalizeText(a).replace('empresa', 'emp'))))
    const cat = /gmf|4x1000|comision|cuota de manejo/.test(nd) ? 'cat-financiero' : /consignacion|venta|pago cliente/.test(nd) ? 'cat-ventas' : undefined
    const type: TransactionType = otherEntity && otherEntity.id !== account.entityId ? 'intercompany_payment' : inflow ? 'income' : cat === 'cat-financiero' ? 'interest' : 'expense'
    const loan = cfg.loans.find((c) => c.accountId === accountId && /leasing|credito|cuota/.test(nd))
    out.push({
      id: newId(), type: loan ? 'loan_payment' : type, confidence: cat || otherEntity || loan ? 88 : 70, evidence: ev, status: 'pending',
      note: !cat && !otherEntity && !loan ? 'Falta clasificar la categoría' : undefined,
      fields: {
        date, amount: value, description: desc, categoryId: loan ? 'cat-financiero' : cat, loanId: loan?.id,
        payerEntityId: type === 'intercompany_payment' && inflow ? otherEntity!.id : account.entityId,
        sourceAccountId: inflow ? (type === 'intercompany_payment' ? cfg.accounts.find((c) => c.entityId === otherEntity!.id)?.id : undefined) : accountId,
        destinationAccountId: inflow ? accountId : undefined,
        allocations: [{ entityId: type === 'intercompany_payment' && inflow ? account.entityId : account.entityId, amount: value }],
      },
    })
  }
  return out
}
