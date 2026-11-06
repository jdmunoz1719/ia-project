// Punto de entrada de la "IA simulada": recibe un texto o archivo y devuelve el soporte (original intacto)
// y el ítem de bandeja con sus propuestas. No toca saldos: sólo propone.
import { findDuplicate } from '@/domain/schedule'
import type { Channel, Transaction, InboxItem, Attachment } from '@/domain/types'
import { extractWhatsAppChat, extractStatement, extractProposals, emptyProposal, type AiConfig } from './extractor'
import { DEMO_FILES, hashText } from './presets'

export type IntakeInput = {
  channel: Channel; receivedAt: string; sender?: string
  text?: string
  file?: { name: string; mimeType: string; size: number; bodyText?: string; url?: string }
}

let n = 0
const id = (p: string) => `${p}-${Date.now().toString(36)}${(n++).toString(36)}`

export function processIntake(e: IntakeInput, cfg: AiConfig, existing: { transactions: Transaction[]; attachments: Attachment[] }): { attachment: Attachment; item: InboxItem } {
  const demo = e.file && DEMO_FILES.find((a) => a.name === e.file!.name)
  let extractedText = ''
  let proposals
  let isTranscript = false

  if (!e.file) {
    extractedText = e.text ?? ''
    proposals = extractProposals(extractedText, e.receivedAt, cfg)
  } else if (demo) {
    extractedText = demo.extractedText
    isTranscript = demo.view === 'audio'
    proposals = demo.mode === 'chat' ? extractWhatsAppChat(extractedText, cfg)
      : demo.mode === 'statement' ? extractStatement(extractedText, demo.accountId!, cfg)
      : extractProposals(extractedText, e.receivedAt, cfg, demo.options)
  } else if (e.file.bodyText) {
    extractedText = e.file.bodyText
    const isChat = /^\d{1,2}\/\d{1,2}\/\d{2,4},?\s.+\s-\s[^:]+:/m.test(extractedText)
    proposals = isChat ? extractWhatsAppChat(extractedText, cfg) : extractProposals(extractedText, e.receivedAt, cfg)
  } else {
    proposals = [emptyProposal(e.receivedAt)]
  }

  const content = e.file ? `${e.file.name}|${e.file.size}|${extractedText}` : extractedText
  const hash = hashText(content)
  const repeated = existing.attachments.find((s) => s.hash === hash)

  const attachment: Attachment = {
    id: id('s'), hash, channel: e.channel, receivedAt: e.receivedAt,
    name: e.file?.name ?? (e.sender ? `Mensaje de ${e.sender}` : 'Mensaje de texto'),
    mimeType: e.file?.mimeType ?? 'text/plain', size: e.file?.size ?? new Blob([extractedText]).size,
    bodyText: e.file ? (demo?.view === 'text' || e.file.bodyText ? extractedText : undefined) : extractedText,
    mockUrl: demo?.url ?? e.file?.url ?? '',
  }

  for (const p of proposals) {
    if (p.type === 'task') continue
    const dup = findDuplicate(p, existing.transactions)
    if (dup) { p.possibleDuplicateOf = dup.id; p.confidence = Math.min(p.confidence, 55) }
  }

  const item: InboxItem = {
    id: id('b'), attachmentId: attachment.id, status: 'pending', proposals, receivedAt: e.receivedAt, channel: e.channel,
    extractedText, isTranscript, duplicateFileOf: repeated?.id,
  }
  return { attachment, item }
}

export const aiLatency = () => 1500 + Math.random() * 1500
