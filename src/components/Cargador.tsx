// Cuadro "¿Qué pasó?": escribir, dictar (simulado) o adjuntar. Lo enviado va a la bandeja y abre la revisión.
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, Loader2, Mic, Paperclip, SendHorizontal, Sparkles, Square, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { leerDataUrl } from '@/components/paneles'
import { useSesion } from '@/hooks/useSesion'
import { api } from '@/services/api'
import { formatTamano } from '@/lib/format'
import { cn } from '@/lib/utils'

const DICTADOS = [
  'Hoy pagué 350 mil de fletes de la mercancía desde Bancolombia de la Empresa B',
  'Ayer nos consignaron 3,2 millones de un cliente en el Banco de Bogotá de la Empresa D por la consultoría',
  'Pasado mañana hay que pagar el IVA de la Empresa A',
]
const MAX = 20 * 1024 * 1024
const ACEPTA = 'image/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.eml,.txt'
const esTexto = (f: File) => /\.(txt|csv|eml)$/i.test(f.name) || f.type.startsWith('text/')

export function Cargador({ grande = false, placeholder }: { grande?: boolean; placeholder?: string }) {
  const [texto, setTexto] = useState('')
  const [archivos, setArchivos] = useState<File[]>([])
  const [grabando, setGrabando] = useState(false)
  const [segundos, setSegundos] = useState(0)
  const [enviando, setEnviando] = useState(false)
  const nDictado = useRef(0)
  const navigate = useNavigate()
  const { puede, hoy } = useSesion()

  // Temporizadores del dictado simulado; se limpian al desmontar o al detener.
  const timers = useRef<number[]>([])
  const limpiarTimers = () => { timers.current.forEach((t) => clearTimeout(t)); timers.current = [] }
  useEffect(() => limpiarTimers, [])

  function iniciarDictado() {
    limpiarTimers()
    setGrabando(true)
    setSegundos(0)
    timers.current.push(window.setInterval(() => setSegundos((x) => x + 1), 1000), window.setTimeout(terminarDictado, 3200))
  }

  function terminarDictado() {
    limpiarTimers()
    setGrabando(false)
    const frase = DICTADOS[nDictado.current++ % DICTADOS.length]
    let i = 0
    const t = window.setInterval(() => { i += 3; setTexto(frase.slice(0, i)); if (i >= frase.length) clearInterval(t) }, 18)
    timers.current.push(t)
  }

  const agregar = (fs: FileList | null) => {
    for (const f of Array.from(fs ?? [])) {
      if (f.size > MAX) { toast.error(`${f.name} supera el máximo de 20 MB`); continue }
      setArchivos((a) => [...a, f])
    }
  }

  const enviar = async () => {
    if (!texto.trim() && !archivos.length) return
    setEnviando(true)
    try {
      const recibidoEn = `${hoy}T${new Date().toTimeString().slice(0, 8)}`
      const ids: string[] = []
      if (texto.trim()) ids.push(await api.bandeja.recibir({ canal: 'manual', recibidoEn, texto: texto.trim() }))
      for (const f of archivos) {
        const url = f.type.startsWith('image/') && f.size < 700_000 ? await leerDataUrl(f) : f.type.startsWith('audio/') || f.type === 'application/pdf' || f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined
        ids.push(await api.bandeja.recibir({ canal: 'manual', recibidoEn, archivo: { nombre: f.name, tipoMime: f.type || 'application/octet-stream', tamano: f.size, url, contenidoTexto: esTexto(f) ? await f.text() : undefined } }))
      }
      setTexto(''); setArchivos([])
      toast.success(ids.length > 1 ? `${ids.length} elementos enviados a la bandeja` : 'Enviado a la bandeja', { description: 'La IA está leyendo el contenido…' })
      navigate(ids.length === 1 ? `/bandeja/${ids[0]}` : '/bandeja')
    } catch (e) { toast.error((e as Error).message) } finally { setEnviando(false) }
  }

  if (!puede('cargar')) return <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Tu rol es de solo consulta: no puede cargar información.</div>

  return (
    <div className={cn('rounded-xl border bg-card shadow-sm transition focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20', grabando && 'border-red-300 ring-3 ring-red-200')}>
      {grabando ? (
        <div className={cn('flex flex-col items-center justify-center gap-3 px-4', grande ? 'h-36' : 'h-28')}>
          <div className="flex h-10 items-end gap-1">
            {Array.from({ length: 24 }, (_, i) => <span key={i} className="w-1 animate-pulse rounded-full bg-red-500" style={{ height: `${20 + ((i * 37) % 80)}%`, animationDelay: `${i * 60}ms` }} />)}
          </div>
          <p className="num text-sm text-red-700">Grabando… 0:{String(segundos).padStart(2, '0')}</p>
        </div>
      ) : (
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={grande ? 4 : 3}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) enviar() }}
          placeholder={placeholder ?? 'Ej.: "Pagué 2.350.000 de arriendo de la bodega desde Bancolombia de la Empresa B". Pegue un mensaje de WhatsApp o adjunte una foto, PDF, Excel o audio.'}
          className={cn('block w-full resize-none rounded-t-xl bg-transparent px-4 pt-3.5 text-[15px] leading-relaxed outline-none placeholder:text-muted-foreground/70', grande && 'text-base')} />
      )}
      {archivos.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 pb-2">
          {archivos.map((f, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 rounded-md border bg-muted/50 px-2 py-1 text-xs">
              <Paperclip className="size-3" />{f.name} <span className="text-muted-foreground">{formatTamano(f.size)}</span>
              <button onClick={() => setArchivos((a) => a.filter((_, j) => j !== i))} aria-label="Quitar"><X className="size-3" /></button>
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-1 border-t px-2 py-2">
        <Button variant="ghost" size="sm" onClick={() => (grabando ? terminarDictado() : iniciarDictado())} className={cn(grabando && 'text-red-600')}>
          {grabando ? <Square className="fill-current" /> : <Mic />}<span className="hidden sm:inline">{grabando ? 'Detener' : 'Dictar'}</span>
        </Button>
        <label className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md px-2.5 text-[0.8rem] font-medium hover:bg-muted">
          <Paperclip className="size-3.5" /><span className="hidden sm:inline">Adjuntar</span>
          <input type="file" multiple accept={ACEPTA} className="hidden" onChange={(e) => { agregar(e.target.files); e.target.value = '' }} />
        </label>
        <label className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md px-2.5 text-[0.8rem] font-medium hover:bg-muted sm:hidden">
          <Camera className="size-3.5" />
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { agregar(e.target.files); e.target.value = '' }} />
        </label>
        <span className="ml-auto hidden items-center gap-1 text-xs text-muted-foreground md:flex"><Sparkles className="size-3" />La IA propone, usted aprueba</span>
        <Button onClick={enviar} disabled={enviando || (!texto.trim() && !archivos.length)} className="ml-2">
          {enviando ? <Loader2 className="animate-spin" /> : <SendHorizontal />}Enviar
        </Button>
      </div>
    </div>
  )
}
