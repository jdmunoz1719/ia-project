import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight, Copy, FileAudio, FileImage, FileSpreadsheet, FileText, Loader2, Mail, MessageCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Uploader } from '@/components/Uploader'
import { LoadingRows, PageHeader, Tag, EmptyState } from '@/components/common'
import { ChannelIcon } from '@/components/panels'
import { useServiceQuery } from '@/hooks/useServiceQuery'
import { useSession } from '@/hooks/useSession'
import { api } from '@/services/api'
import { formatDateTime, formatSize } from '@/lib/format'
import { cn } from '@/lib/utils'

const VIEW_ICON = { image: FileImage, pdf: FileText, audio: FileAudio, text: MessageCircle, table: FileSpreadsheet, email: Mail }

export function ConnectedChannels() {
  const navigate = useNavigate()
  // Botón "oculto" para la demo: el punto verde inyecta un mensaje entrante (también Ctrl+Shift+W / Ctrl+Shift+E).
  const inject = async (channel: 'whatsapp' | 'email') => {
    const id = await api.inbox.inject(channel)
    toast(channel === 'whatsapp' ? 'Nuevo mensaje de WhatsApp' : 'Nuevo correo', { description: 'Llegó a la bandeja; la IA lo está leyendo', action: { label: 'Revisar', onClick: () => navigate(`/bandeja/${id}`) } })
  }
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1">
        <button onClick={() => inject('whatsapp')} data-demo-trigger className="relative flex size-2" aria-label="Simular mensaje entrante" title="">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
        </button>
        <MessageCircle className="size-3.5 text-emerald-600" />WhatsApp conectado · <span className="num">+57 310 ••• 4821</span>
      </span>
      <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1">
        <button onClick={() => inject('email')} data-demo-trigger className="relative flex size-2" aria-label="Simular correo entrante"><span className="relative inline-flex size-2 rounded-full bg-sky-500" /></button>
        <Mail className="size-3.5 text-sky-600" />Correo conectado · bandeja@cajaclara.co
      </span>
    </div>
  )
}

export function SampleFiles() {
  const { data } = useServiceQuery(() => api.inbox.demoFiles(), [])
  const navigate = useNavigate()
  const [loading, setLoading] = useState<string>()
  const { can } = useSession()
  if (!can('upload')) return null
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-sm font-semibold">Archivos de ejemplo</p>
      <p className="mb-3 text-xs text-muted-foreground">Cárgalos con un clic para ver cómo los lee la IA.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {data?.map((a) => {
          const I = VIEW_ICON[a.view]
          return (
            <button key={a.name} disabled={!!loading} onClick={async () => { setLoading(a.name); const id = await api.inbox.loadDemoFile(a.name); setLoading(undefined); navigate(`/bandeja/${id}`) }}
              className="flex items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition hover:border-primary/40 hover:bg-accent disabled:opacity-60">
              {loading === a.name ? <Loader2 className="size-5 shrink-0 animate-spin text-primary" /> : <I className="size-5 shrink-0 text-primary" />}
              <span className="min-w-0"><span className="block truncate font-medium">{a.name}</span><span className="block text-xs text-muted-foreground">{a.description} · {formatSize(a.size)}</span></span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function InboxPage() {
  const { data, loading } = useServiceQuery(() => api.inbox.list(), [])
  const [tabFilter, setTabFilter] = useState<'pendientes' | 'revisados' | 'todos'>('pendientes')
  const items = (data ?? []).filter((i) => tabFilter === 'todos' || (tabFilter === 'pendientes' ? i.status !== 'reviewed' : i.status === 'reviewed'))
  const n = (f: typeof tabFilter) => (data ?? []).filter((i) => f === 'todos' || (f === 'pendientes' ? i.status !== 'reviewed' : i.status === 'reviewed')).length

  return (
    <div>
      <PageHeader title="Bandeja de entrada" description="Todo entra por aquí. Nada cuenta hasta que lo apruebes." actions={<ConnectedChannels />} />
      {/* grid-cols-1 explícito: sin él, la columna implícita crece con el texto más ancho y empuja la página a 845 px en celular. */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <Uploader placeholder="Pega un mensaje de WhatsApp, escribe lo que pasó o adjunta archivos (fotos, PDF, Word, Excel, CSV, .eml, chats .txt, audios · máx. 20 MB)" />
          <div className="flex items-center gap-1 rounded-lg bg-muted p-1 text-sm w-fit">
            {(['pendientes', 'revisados', 'todos'] as const).map((f) => (
              <button key={f} onClick={() => setTabFilter(f)} className={cn('rounded-md px-3 py-1 capitalize transition', tabFilter === f ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                {f} <span className="num text-xs text-muted-foreground">{n(f)}</span>
              </button>
            ))}
          </div>
          {loading ? <LoadingRows rows={5} /> : !items.length ? <EmptyState title={tabFilter === 'pendientes' ? 'Todo al día' : 'Sin elementos'} text={tabFilter === 'pendientes' ? 'No hay nada pendiente por revisar.' : undefined} /> : (
            <ul className="divide-y overflow-hidden rounded-xl border bg-card">
              {items.map((i) => {
                const pend = i.proposals.filter((p) => p.status === 'pending').length
                const dup = !!i.duplicateFileOf || i.proposals.some((p) => p.possibleDuplicateOf && p.status === 'pending')
                return (
                  <li key={i.id} className={cn(i.incoming && 'animar-entrada')}>
                    <Link to={`/bandeja/${i.id}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-muted/50">
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted"><ChannelIcon channel={i.channel} /></span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{i.attachment.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{i.extractedText?.slice(0, 110) || i.attachment.mimeType}</p>
                      </div>
                      <div className="hidden flex-col items-end gap-1 sm:flex">
                        <span className="num text-xs text-muted-foreground">{formatDateTime(i.receivedAt)}</span>
                        <div className="flex gap-1">
                          {dup && <Tag tone="amber"><Copy />Posible duplicado</Tag>}
                          {i.status === 'processing' ? <Tag tone="blue"><Loader2 className="animate-spin" />Leyendo…</Tag>
                            : i.status === 'reviewed' ? <Tag tone="green">Revisado</Tag>
                              : <Tag tone="amber">{pend} por revisar</Tag>}
                        </div>
                      </div>
                      <span className={cn('num grid size-6 place-items-center rounded-full text-xs font-semibold sm:hidden', pend ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700')}>{i.status === 'processing' ? '…' : pend || '✓'}</span>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        <aside className="space-y-4"><SampleFiles /></aside>
      </div>
    </div>
  )
}
