// Cuadro "¿Qué pasó?": escribir, dictar (simulado) o adjuntar. Lo enviado va a la bandeja y abre la revisión.
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, Loader2, Mic, Paperclip, SendHorizontal, Sparkles, Square, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { readDataUrl } from '@/components/panels'
import { useSession } from '@/hooks/useSession'
import { api } from '@/services/api'
import { formatSize } from '@/lib/format'
import { cn } from '@/lib/utils'

const DICTATIONS = [
  'Hoy pagué 350 mil de fletes de la mercancía desde Bancolombia de la Empresa B',
  'Ayer nos consignaron 3,2 millones de un cliente en el Banco de Bogotá de la Empresa D por la consultoría',
  'Pasado mañana hay que pagar el IVA de la Empresa A',
]
const MAX = 20 * 1024 * 1024
const ACCEPTED_TYPES = 'image/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.eml,.txt'
const isTextFile = (f: File) => /\.(txt|csv|eml)$/i.test(f.name) || f.type.startsWith('text/')

export function Uploader({ large = false, placeholder }: { large?: boolean; placeholder?: string }) {
  const [text, setText] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [sending, setSending] = useState(false)
  const dictationIndex = useRef(0)
  const navigate = useNavigate()
  const { can, today } = useSession()

  // Temporizadores del dictado simulado; se limpian al desmontar o al detener.
  const timers = useRef<number[]>([])
  const clearTimers = () => { timers.current.forEach((t) => clearTimeout(t)); timers.current = [] }
  useEffect(() => clearTimers, [])

  function startDictation() {
    clearTimers()
    setRecording(true)
    setSeconds(0)
    timers.current.push(window.setInterval(() => setSeconds((x) => x + 1), 1000), window.setTimeout(stopDictation, 3200))
  }

  function stopDictation() {
    clearTimers()
    setRecording(false)
    const phrase = DICTATIONS[dictationIndex.current++ % DICTATIONS.length]
    let i = 0
    const t = window.setInterval(() => { i += 3; setText(phrase.slice(0, i)); if (i >= phrase.length) clearInterval(t) }, 18)
    timers.current.push(t)
  }

  const addFiles = (fs: FileList | null) => {
    for (const f of Array.from(fs ?? [])) {
      if (f.size > MAX) { toast.error(`${f.name} supera el máximo de 20 MB`); continue }
      setFiles((a) => [...a, f])
    }
  }

  const send = async () => {
    if (!text.trim() && !files.length) return
    setSending(true)
    try {
      const receivedAt = `${today}T${new Date().toTimeString().slice(0, 8)}`
      const ids: string[] = []
      if (text.trim()) ids.push(await api.inbox.receive({ channel: 'manual', receivedAt, text: text.trim() }))
      for (const f of files) {
        const url = f.type.startsWith('image/') && f.size < 700_000 ? await readDataUrl(f) : f.type.startsWith('audio/') || f.type === 'application/pdf' || f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined
        ids.push(await api.inbox.receive({ channel: 'manual', receivedAt, file: { name: f.name, mimeType: f.type || 'application/octet-stream', size: f.size, url, bodyText: isTextFile(f) ? await f.text() : undefined } }))
      }
      setText(''); setFiles([])
      toast.success(ids.length > 1 ? `${ids.length} elementos enviados a la bandeja` : 'Enviado a la bandeja', { description: 'La IA está leyendo el contenido…' })
      navigate(ids.length === 1 ? `/bandeja/${ids[0]}` : '/bandeja')
    } catch (e) { toast.error((e as Error).message) } finally { setSending(false) }
  }

  if (!can('upload')) return <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Tu rol es de solo consulta: no puedes cargar información.</div>

  return (
    <div className={cn('rounded-xl border bg-card shadow-sm transition focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20', recording && 'border-red-300 ring-3 ring-red-200')}>
      {recording ? (
        <div className={cn('flex flex-col items-center justify-center gap-3 px-4', large ? 'h-36' : 'h-28')}>
          <div className="flex h-10 items-end gap-1">
            {Array.from({ length: 24 }, (_, i) => <span key={i} className="w-1 animate-pulse rounded-full bg-red-500" style={{ height: `${20 + ((i * 37) % 80)}%`, animationDelay: `${i * 60}ms` }} />)}
          </div>
          <p className="num text-sm text-red-700">Grabando… 0:{String(seconds).padStart(2, '0')}</p>
        </div>
      ) : (
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={large ? 4 : 3}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send() }}
          placeholder={placeholder ?? 'Ej.: "Pagué 2.350.000 de arriendo de la bodega desde Bancolombia de la Empresa B". Pega un mensaje de WhatsApp o adjunta una foto, PDF, Excel o audio.'}
          className={cn('block w-full resize-none rounded-t-xl bg-transparent px-4 pt-3.5 text-[15px] leading-relaxed outline-none placeholder:text-muted-foreground/70', large && 'text-base')} />
      )}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 pb-2">
          {files.map((f, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 rounded-md border bg-muted/50 px-2 py-1 text-xs">
              <Paperclip className="size-3" />{f.name} <span className="text-muted-foreground">{formatSize(f.size)}</span>
              <button onClick={() => setFiles((a) => a.filter((_, j) => j !== i))} aria-label="Quitar"><X className="size-3" /></button>
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-1 border-t px-2 py-2">
        <Button variant="ghost" size="sm" onClick={() => (recording ? stopDictation() : startDictation())} className={cn('h-11 sm:h-7', recording && 'text-red-600')}>
          {recording ? <Square className="fill-current" /> : <Mic />}<span className="hidden sm:inline">{recording ? 'Detener' : 'Dictar'}</span>
        </Button>
        <label className="inline-flex h-11 cursor-pointer items-center gap-1 rounded-md px-2.5 text-[0.8rem] font-medium hover:bg-muted sm:h-7">
          <Paperclip className="size-3.5" /><span className="hidden sm:inline">Adjuntar</span>
          <input type="file" multiple accept={ACCEPTED_TYPES} className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
        </label>
        <label className="inline-flex h-11 cursor-pointer items-center gap-1 rounded-md px-2.5 text-[0.8rem] font-medium hover:bg-muted sm:hidden">
          <Camera className="size-3.5" />
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
        </label>
        <span className="ml-auto hidden items-center gap-1 text-xs text-muted-foreground md:flex"><Sparkles className="size-3" />La IA propone, tú apruebas</span>
        <Button onClick={send} disabled={sending || (!text.trim() && !files.length)} className="ml-2 h-11 sm:h-8">
          {sending ? <Loader2 className="animate-spin" /> : <SendHorizontal />}Enviar
        </Button>
      </div>
    </div>
  )
}
