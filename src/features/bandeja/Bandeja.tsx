import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight, Copy, FileAudio, FileImage, FileSpreadsheet, FileText, Loader2, Mail, MessageCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Cargador } from '@/components/Cargador'
import { Cargando, Encabezado, Etiqueta, Vacio } from '@/components/comunes'
import { IconoCanal } from '@/components/paneles'
import { useConsulta } from '@/hooks/useConsulta'
import { useSesion } from '@/hooks/useSesion'
import { api } from '@/services/api'
import { formatFechaHora, formatTamano } from '@/lib/format'
import { cn } from '@/lib/utils'

const ICONO_VISTA = { imagen: FileImage, pdf: FileText, audio: FileAudio, texto: MessageCircle, tabla: FileSpreadsheet, correo: Mail }

export function Conectados() {
  const navigate = useNavigate()
  // Botón "oculto" para la demo: el punto verde inyecta un mensaje entrante (también Ctrl+Shift+W / Ctrl+Shift+E).
  const inyectar = async (canal: 'whatsapp' | 'correo') => {
    const id = await api.bandeja.inyectar(canal)
    toast(canal === 'whatsapp' ? 'Nuevo mensaje de WhatsApp' : 'Nuevo correo', { description: 'Llegó a la bandeja; la IA lo está leyendo', action: { label: 'Revisar', onClick: () => navigate(`/bandeja/${id}`) } })
  }
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1">
        <button onClick={() => inyectar('whatsapp')} className="relative flex size-2" aria-label="Simular mensaje entrante" title="">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
        </button>
        <MessageCircle className="size-3.5 text-emerald-600" />WhatsApp conectado · <span className="num">+57 310 ••• 4821</span>
      </span>
      <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1">
        <button onClick={() => inyectar('correo')} className="relative flex size-2" aria-label="Simular correo entrante"><span className="relative inline-flex size-2 rounded-full bg-sky-500" /></button>
        <Mail className="size-3.5 text-sky-600" />Correo conectado · bandeja@cajaclara.co
      </span>
    </div>
  )
}

export function ArchivosEjemplo() {
  const { data } = useConsulta(() => api.bandeja.archivosDemo(), [])
  const navigate = useNavigate()
  const [cargando, setCargando] = useState<string>()
  const { puede } = useSesion()
  if (!puede('cargar')) return null
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-sm font-semibold">Archivos de ejemplo</p>
      <p className="mb-3 text-xs text-muted-foreground">Cárguelos con un clic para ver cómo los lee la IA.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {data?.map((a) => {
          const I = ICONO_VISTA[a.vista]
          return (
            <button key={a.nombre} disabled={!!cargando} onClick={async () => { setCargando(a.nombre); const id = await api.bandeja.cargarArchivoDemo(a.nombre); setCargando(undefined); navigate(`/bandeja/${id}`) }}
              className="flex items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition hover:border-primary/40 hover:bg-accent disabled:opacity-60">
              {cargando === a.nombre ? <Loader2 className="size-5 shrink-0 animate-spin text-primary" /> : <I className="size-5 shrink-0 text-primary" />}
              <span className="min-w-0"><span className="block truncate font-medium">{a.nombre}</span><span className="block text-xs text-muted-foreground">{a.descripcion} · {formatTamano(a.tamano)}</span></span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function Bandeja() {
  const { data, cargando } = useConsulta(() => api.bandeja.listar(), [])
  const [filtro, setFiltro] = useState<'pendientes' | 'revisados' | 'todos'>('pendientes')
  const items = (data ?? []).filter((i) => filtro === 'todos' || (filtro === 'pendientes' ? i.estado !== 'revisado' : i.estado === 'revisado'))
  const n = (f: typeof filtro) => (data ?? []).filter((i) => f === 'todos' || (f === 'pendientes' ? i.estado !== 'revisado' : i.estado === 'revisado')).length

  return (
    <div>
      <Encabezado titulo="Bandeja de entrada" descripcion="Todo entra por aquí. Nada cuenta hasta que usted lo apruebe." acciones={<Conectados />} />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <Cargador placeholder="Pegue un mensaje de WhatsApp, escriba lo que pasó o adjunte archivos (fotos, PDF, Word, Excel, CSV, .eml, chats .txt, audios · máx. 20 MB)" />
          <div className="flex items-center gap-1 rounded-lg bg-muted p-1 text-sm w-fit">
            {(['pendientes', 'revisados', 'todos'] as const).map((f) => (
              <button key={f} onClick={() => setFiltro(f)} className={cn('rounded-md px-3 py-1 capitalize transition', filtro === f ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                {f} <span className="num text-xs text-muted-foreground">{n(f)}</span>
              </button>
            ))}
          </div>
          {cargando ? <Cargando filas={5} /> : !items.length ? <Vacio titulo={filtro === 'pendientes' ? 'Todo al día' : 'Sin elementos'} texto={filtro === 'pendientes' ? 'No hay nada pendiente por revisar.' : undefined} /> : (
            <ul className="divide-y overflow-hidden rounded-xl border bg-card">
              {items.map((i) => {
                const pend = i.propuestas.filter((p) => p.estado === 'pendiente').length
                const dup = !!i.archivoDuplicadoDe || i.propuestas.some((p) => p.posibleDuplicadoDe && p.estado === 'pendiente')
                return (
                  <li key={i.id} className={cn(i.entrante && 'animar-entrada')}>
                    <Link to={`/bandeja/${i.id}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-muted/50">
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted"><IconoCanal canal={i.canal} /></span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{i.soporte.nombre}</p>
                        <p className="truncate text-xs text-muted-foreground">{i.textoExtraido?.slice(0, 110) || i.soporte.tipoMime}</p>
                      </div>
                      <div className="hidden flex-col items-end gap-1 sm:flex">
                        <span className="num text-xs text-muted-foreground">{formatFechaHora(i.recibidoEn)}</span>
                        <div className="flex gap-1">
                          {dup && <Etiqueta tono="ambar"><Copy />Posible duplicado</Etiqueta>}
                          {i.estado === 'procesando' ? <Etiqueta tono="azul"><Loader2 className="animate-spin" />Leyendo…</Etiqueta>
                            : i.estado === 'revisado' ? <Etiqueta tono="verde">Revisado</Etiqueta>
                              : <Etiqueta tono="ambar">{pend} por revisar</Etiqueta>}
                        </div>
                      </div>
                      <span className={cn('num grid size-6 place-items-center rounded-full text-xs font-semibold sm:hidden', pend ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700')}>{i.estado === 'procesando' ? '…' : pend || '✓'}</span>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        <aside className="space-y-4"><ArchivosEjemplo /></aside>
      </div>
    </div>
  )
}
