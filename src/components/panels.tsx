// Paneles globales: detalle de una cifra (drill-down) → movimiento → soporte original.
import { useState, type ReactNode } from 'react'
import { create } from 'zustand'
import { AlertTriangle, ArrowLeft, FileText, Lock, Mail, MessageCircle, Mic, Paperclip, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Tag, DateText, Money, LoadingRows, EmptyState } from '@/components/common'
import { useServiceQuery } from '@/hooks/useServiceQuery'
import { useSession } from '@/hooks/useSession'
import { api, TYPE_NAME, type Config } from '@/services/api'
import type { Evidence, LedgerLine, Attachment } from '@/domain/types'
import { formatCOP, formatDateTime, formatSize } from '@/lib/format'
import { cn } from '@/lib/utils'

type Panel = { type: 'list'; title: string; subtitle?: string; transactionIds: string[] } | { type: 'transaction'; id: string }
type PanelsState = { stack: Panel[]; open: (p: Panel) => void; back: () => void; close: () => void }
export const usePanels = create<PanelsState>((set) => ({
  stack: [],
  open: (p) => set((s) => ({ stack: [...s.stack, p] })),
  back: () => set((s) => ({ stack: s.stack.slice(0, -1) })),
  close: () => set({ stack: [] }),
}))
export const openDetail = (title: string, transactionIds: string[], subtitle?: string) => usePanels.getState().open({ type: 'list', title, transactionIds, subtitle })
export const openTransaction = (id: string) => usePanels.getState().open({ type: 'transaction', id })

/** Cifra clicable: lleva a los movimientos que la forman. */
export function Figure({ value, lines, title, className, color, children }: { value: number; lines: LedgerLine[]; title: string; className?: string; color?: boolean; children?: ReactNode }) {
  const ids = [...new Set(lines.map((l) => l.transactionId))]
  return (
    <button type="button" onClick={() => openDetail(title, ids, `${ids.length} movimientos forman ${formatCOP(value)}`)}
      className={cn('num cursor-pointer rounded-sm text-left underline decoration-dotted decoration-muted-foreground/40 underline-offset-4 transition hover:decoration-primary hover:text-primary', className)}
      title="Ver los movimientos que forman esta cifra">
      {children ?? <Money value={value} color={color} />}
    </button>
  )
}

// ---------------- Resaltado de evidencia ----------------
export type Mark = Evidence & { markKey: string }
export function TextWithEvidence({ text, marks, active, className }: { text: string; marks: Mark[]; active?: string | null; className?: string }) {
  const ord = [...marks].sort((a, b) => a.start - b.start)
  const parts: ReactNode[] = []
  let pos = 0
  for (const m of ord) {
    if (m.start < pos || m.end > text.length) continue
    if (m.start > pos) parts.push(text.slice(pos, m.start))
    const on = active === m.markKey || (active != null && m.markKey.startsWith(active + ':'))
    parts.push(<mark key={m.markKey + m.start} data-clave={m.markKey} className={cn('evidencia', on && 'activa')}>{text.slice(m.start, m.end)}</mark>)
    pos = m.end
  }
  parts.push(text.slice(pos))
  return <div className={cn('whitespace-pre-wrap break-words', className)}>{parts}</div>
}

const isImage = (s: Attachment) => s.mimeType.startsWith('image/')
const isAudio = (s: Attachment) => s.mimeType.startsWith('audio/')
const isPdf = (s: Attachment) => s.mimeType === 'application/pdf'

export function ChannelIcon({ channel, className }: { channel: string; className?: string }) {
  const I = channel === 'email' ? Mail : channel === 'whatsapp' || channel === 'whatsapp_export' ? MessageCircle : channel === 'drive' ? FileText : Paperclip
  return <I className={cn('size-4', channel.startsWith('whatsapp') ? 'text-emerald-600' : channel === 'email' ? 'text-sky-600' : 'text-muted-foreground', className)} />
}

/** El original intacto, con los fragmentos de evidencia resaltados. */
export function AttachmentViewer({ attachment, text, marks = [], active, isTranscript }: { attachment: Attachment; text?: string; marks?: Mark[]; active?: string | null; isTranscript?: boolean }) {
  const t = text ?? attachment.bodyText ?? ''
  const isChat = attachment.channel === 'whatsapp' && !attachment.mockUrl
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <ChannelIcon channel={attachment.channel} />
        <span className="font-medium text-foreground">{attachment.name}</span>
        <span>· {formatDateTime(attachment.receivedAt)}</span>
        <span>· {formatSize(attachment.size)}</span>
        <Tag tone="gray" className="ml-auto"><Lock />Original sin modificar</Tag>
      </div>
      {isImage(attachment) && attachment.mockUrl && <img src={attachment.mockUrl} alt={attachment.name} className="max-h-[420px] w-full rounded-lg border bg-muted object-contain" />}
      {isPdf(attachment) && attachment.mockUrl && <iframe src={attachment.mockUrl} title={attachment.name} className="h-80 w-full rounded-lg border bg-white" />}
      {isAudio(attachment) && attachment.mockUrl && <audio controls src={attachment.mockUrl} className="w-full" />}
      {t && (
        <div>
          {(isImage(attachment) || isPdf(attachment) || isAudio(attachment) || attachment.mimeType.includes('sheet')) && (
            <p className="mb-1.5 flex items-center gap-1 text-xs font-medium text-muted-foreground">
              {isAudio(attachment) || isTranscript ? <><Mic className="size-3" />Transcripción de la IA</> : <><FileText className="size-3" />Texto leído por la IA</>}
            </p>
          )}
          <TextWithEvidence text={t} marks={marks} active={active}
            className={cn('rounded-lg border p-3 text-sm leading-relaxed',
              isChat ? 'max-w-[95%] rounded-tl-none border-emerald-200 bg-emerald-50/70' : attachment.mimeType.includes('sheet') || attachment.mimeType === 'text/plain' && attachment.channel === 'whatsapp_export' ? 'bg-muted/40 font-mono text-xs' : 'bg-card')} />
        </div>
      )}
      {!t && !attachment.mockUrl && <EmptyState title="Vista previa no disponible" text="El archivo está guardado tal como se recibió." />}
    </div>
  )
}

// ---------------- Detalle de un movimiento ----------------
function conceptName(l: LedgerLine, cfg?: Config) {
  const ent = (id?: string) => cfg?.entities.find((e) => e.id === id)?.name ?? '—'
  switch (l.concept) {
    case 'cash': return `Caja y bancos${l.accountId ? ` · ${cfg?.accounts.find((c) => c.id === l.accountId)?.bank ?? ''}` : ''}`
    case 'result': return { income: 'Ingreso', cost_of_sales: 'Costo de ventas', operating_expense: 'Gasto operativo', financial: 'Gasto financiero' }[l.resultClass!]
    case 'ic_receivable': return `Por cobrar a ${ent(l.counterpartId)}`
    case 'ic_payable': return `Por pagar a ${ent(l.counterpartId)}`
    case 'loan': return 'Deuda del crédito'
    case 'investment': return 'Inversión en proyecto'
  }
}

export function LedgerLines({ lines, cfg }: { lines: LedgerLine[]; cfg?: Config }) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs text-muted-foreground"><tr><th className="px-3 py-2 text-left font-medium">Empresa</th><th className="px-3 py-2 text-left font-medium">Concepto</th><th className="px-3 py-2 text-right font-medium">Efecto</th></tr></thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i} className="border-t">
              <td className="px-3 py-2">{cfg?.entities.find((e) => e.id === l.entityId)?.name}</td>
              <td className="px-3 py-2 text-muted-foreground">{conceptName(l, cfg)}</td>
              <td className="px-3 py-2 text-right"><Money value={l.amount} sign color={l.concept === 'cash' || l.concept === 'result'} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TransactionDetail({ id }: { id: string }) {
  const { data, loading } = useServiceQuery(() => api.movements.detail(id), [id])
  const { data: cfg } = useServiceQuery(() => api.settings.get(), [])
  const { can } = useSession()
  const [uploading, setUploading] = useState(false)
  if (loading || !data) return <LoadingRows rows={6} />
  const { transaction: h, lines, attachments, locked } = data
  const n = <T extends { id: string; name: string }>(arr: T[] | undefined, x?: string) => arr?.find((a) => a.id === x)?.name
  const attach = async (f: File) => {
    setUploading(true)
    try {
      await api.movements.attachFile(h.id, { name: f.name, mimeType: f.type || 'application/octet-stream', size: f.size, url: f.type.startsWith('image/') && f.size < 900_000 ? await readDataUrl(f) : '' })
      toast.success('Soporte adjuntado')
    } catch (e) { toast.error((e as Error).message) } finally { setUploading(false) }
  }
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Tag tone="blue">{TYPE_NAME[h.type]}</Tag>
          {locked && <Tag tone="gray"><Lock />Mes cerrado</Tag>}
          {h.attachmentIds.length === 0 && <Tag tone="amber"><AlertTriangle />Sin soporte</Tag>}
          {h.allocations.some((a) => a.entityId !== h.payerEntityId) && <Tag tone="amber">Entre empresas</Tag>}
        </div>
        <p className="text-2xl font-semibold"><Money value={h.amount} /></p>
        <p className="text-sm">{h.description}</p>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {[
          ['Fecha', <DateText key="f" iso={h.date} />],
          ['Paga', n(cfg?.entities, h.payerEntityId)],
          [h.destinationAccountId && !h.sourceAccountId ? 'Entra a' : 'Sale de', cfg?.accounts.find((c) => c.id === (h.sourceAccountId ?? h.destinationAccountId))?.name],
          ...(h.sourceAccountId && h.destinationAccountId ? [['Entra a', cfg?.accounts.find((c) => c.id === h.destinationAccountId)?.name]] : []),
          ['Pertenece a', h.allocations.map((a) => `${n(cfg?.entities, a.entityId)}${a.projectId ? ` · ${n(cfg?.projects, a.projectId)}` : ''}${h.allocations.length > 1 ? ` (${formatCOP(a.amount)})` : ''}`).join(' + ')],
          ['Categoría', n(cfg?.categories, h.categoryId) ?? '—'],
          ['Tercero', n(cfg?.counterparties, h.counterpartyId) ?? '—'],
          ['Aprobado por', `${h.approvedBy} · ${formatDateTime(h.approvedAt)}`],
        ].map(([k, v], i) => <div key={i} className="min-w-0"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="truncate">{v ?? '—'}</dd></div>)}
      </dl>
      {h.loanPaymentBreakdown && (
        <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-3 text-sm">
          {(['capital', 'interest', 'fees'] as const).map((k) => <div key={k}><p className="text-xs text-muted-foreground capitalize">{k === 'interest' ? 'Interés' : k}</p><Money value={h.loanPaymentBreakdown![k]} /></div>)}
        </div>
      )}
      <section>
        <h3 className="mb-2 text-sm font-semibold">¿Cómo afecta?</h3>
        <LedgerLines lines={lines} cfg={cfg} />
        <p className="mt-1.5 text-xs text-muted-foreground">Se registró una sola vez; estas líneas las calcula el sistema.</p>
      </section>
      <section>
        <h3 className="mb-2 text-sm font-semibold">Soporte original</h3>
        {attachments.length ? <div className="space-y-4">{attachments.map((s) => <AttachmentViewer key={s.id} attachment={s} />)}</div> : (
          <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50/50 p-4 text-sm">
            <p className="flex items-center gap-2 font-medium text-amber-800"><AlertTriangle className="size-4" />Este movimiento no tiene soporte</p>
            {can('upload') && (
              <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border bg-background px-3 py-1.5 text-sm hover:bg-muted">
                <Upload className="size-4" />{uploading ? 'Adjuntando…' : 'Adjuntar soporte'}
                <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && attach(e.target.files[0])} />
              </label>
            )}
          </div>
        )}
      </section>
    </div>
  )
}

export const readDataUrl = (f: File) => new Promise<string>((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.readAsDataURL(f) })

function TransactionList({ ids }: { ids: string[] }) {
  const { data, loading } = useServiceQuery(() => api.movements.list({ ids }), [ids.join()])
  const { data: cfg } = useServiceQuery(() => api.settings.get(), [])
  if (loading || !data) return <LoadingRows rows={8} />
  if (!data.length) return <EmptyState title="Sin movimientos" text="No hay movimientos aprobados que formen esta cifra." />
  return (
    <ul className="divide-y rounded-lg border">
      {data.map((h) => (
        <li key={h.id}>
          <button onClick={() => openTransaction(h.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-muted/60">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate font-medium">{h.attachmentIds.length === 0 && <AlertTriangle className="size-3.5 shrink-0 text-amber-600" />}{h.description}</p>
              <p className="truncate text-xs text-muted-foreground"><DateText iso={h.date} /> · {TYPE_NAME[h.type]} · {h.allocations.map((a) => cfg?.entities.find((e) => e.id === a.entityId)?.name).join(', ')}</p>
            </div>
            <Money value={['income', 'loan_disbursement'].includes(h.type) ? h.amount : -h.amount} color />
          </button>
        </li>
      ))}
    </ul>
  )
}

export function GlobalPanels() {
  const { stack, back, close } = usePanels()
  const current = stack.at(-1)
  return (
    <Sheet open={!!current} onOpenChange={(o) => !o && close()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl! data-[side=right]:sm:max-w-xl">
        {current && (
          <>
            <SheetHeader className="border-b pb-3">
              {stack.length > 1 && <Button variant="ghost" size="sm" className="-ml-2 w-fit" onClick={back}><ArrowLeft />Volver</Button>}
              <SheetTitle>{current.type === 'list' ? current.title : 'Detalle del movimiento'}</SheetTitle>
              <SheetDescription>{current.type === 'list' ? current.subtitle : 'De la cifra al movimiento y del movimiento a su soporte'}</SheetDescription>
            </SheetHeader>
            <div className="px-4 pb-6">{current.type === 'list' ? <TransactionList ids={current.transactionIds} /> : <TransactionDetail id={current.id} />}</div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
