// Paneles globales: detalle de una cifra (drill-down) → movimiento → soporte original.
import { useState, type ReactNode } from 'react'
import { create } from 'zustand'
import { AlertTriangle, ArrowLeft, FileText, Lock, Mail, MessageCircle, Mic, Paperclip, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Etiqueta, Fecha, Money, Cargando, Vacio } from '@/components/comunes'
import { useConsulta } from '@/hooks/useConsulta'
import { useSesion } from '@/hooks/useSesion'
import { api, NOMBRE_TIPO, type Config } from '@/services/api'
import type { Evidencia, LineaLibro, Soporte } from '@/domain/tipos'
import { formatCOP, formatFechaHora, formatTamano } from '@/lib/format'
import { cn } from '@/lib/utils'

type Panel = { tipo: 'lista'; titulo: string; subtitulo?: string; hechoIds: string[] } | { tipo: 'movimiento'; id: string }
type PanelesState = { pila: Panel[]; abrir: (p: Panel) => void; volver: () => void; cerrar: () => void }
export const usePaneles = create<PanelesState>((set) => ({
  pila: [],
  abrir: (p) => set((s) => ({ pila: [...s.pila, p] })),
  volver: () => set((s) => ({ pila: s.pila.slice(0, -1) })),
  cerrar: () => set({ pila: [] }),
}))
export const abrirDetalle = (titulo: string, hechoIds: string[], subtitulo?: string) => usePaneles.getState().abrir({ tipo: 'lista', titulo, hechoIds, subtitulo })
export const abrirMovimiento = (id: string) => usePaneles.getState().abrir({ tipo: 'movimiento', id })

/** Cifra clicable: lleva a los movimientos que la forman. */
export function Cifra({ valor, lineas, titulo, className, color, children }: { valor: number; lineas: LineaLibro[]; titulo: string; className?: string; color?: boolean; children?: ReactNode }) {
  const ids = [...new Set(lineas.map((l) => l.hechoId))]
  return (
    <button type="button" onClick={() => abrirDetalle(titulo, ids, `${ids.length} movimientos forman ${formatCOP(valor)}`)}
      className={cn('num cursor-pointer rounded-sm text-left underline decoration-dotted decoration-muted-foreground/40 underline-offset-4 transition hover:decoration-primary hover:text-primary', className)}
      title="Ver los movimientos que forman esta cifra">
      {children ?? <Money valor={valor} color={color} />}
    </button>
  )
}

// ---------------- Resaltado de evidencia ----------------
export type Marca = Evidencia & { clave: string }
export function TextoConEvidencia({ texto, marcas, activa, className }: { texto: string; marcas: Marca[]; activa?: string | null; className?: string }) {
  const ord = [...marcas].sort((a, b) => a.inicio - b.inicio)
  const partes: ReactNode[] = []
  let pos = 0
  for (const m of ord) {
    if (m.inicio < pos || m.fin > texto.length) continue
    if (m.inicio > pos) partes.push(texto.slice(pos, m.inicio))
    const on = activa === m.clave || (activa != null && m.clave.startsWith(activa + ':'))
    partes.push(<mark key={m.clave + m.inicio} data-clave={m.clave} className={cn('evidencia', on && 'activa')}>{texto.slice(m.inicio, m.fin)}</mark>)
    pos = m.fin
  }
  partes.push(texto.slice(pos))
  return <div className={cn('whitespace-pre-wrap break-words', className)}>{partes}</div>
}

const esImagen = (s: Soporte) => s.tipoMime.startsWith('image/')
const esAudio = (s: Soporte) => s.tipoMime.startsWith('audio/')
const esPdf = (s: Soporte) => s.tipoMime === 'application/pdf'

export function IconoCanal({ canal, className }: { canal: string; className?: string }) {
  const I = canal === 'correo' ? Mail : canal === 'whatsapp' || canal === 'whatsapp_export' ? MessageCircle : canal === 'drive' ? FileText : Paperclip
  return <I className={cn('size-4', canal.startsWith('whatsapp') ? 'text-emerald-600' : canal === 'correo' ? 'text-sky-600' : 'text-muted-foreground', className)} />
}

/** El original intacto, con los fragmentos de evidencia resaltados. */
export function VisorSoporte({ soporte, texto, marcas = [], activa, transcripcion }: { soporte: Soporte; texto?: string; marcas?: Marca[]; activa?: string | null; transcripcion?: boolean }) {
  const t = texto ?? soporte.contenidoTexto ?? ''
  const esChat = soporte.canal === 'whatsapp' && !soporte.urlMock
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <IconoCanal canal={soporte.canal} />
        <span className="font-medium text-foreground">{soporte.nombre}</span>
        <span>· {formatFechaHora(soporte.recibidoEn)}</span>
        <span>· {formatTamano(soporte.tamano)}</span>
        <Etiqueta tono="gris" className="ml-auto"><Lock />Original sin modificar</Etiqueta>
      </div>
      {esImagen(soporte) && soporte.urlMock && <img src={soporte.urlMock} alt={soporte.nombre} className="max-h-[420px] w-full rounded-lg border bg-muted object-contain" />}
      {esPdf(soporte) && soporte.urlMock && <iframe src={soporte.urlMock} title={soporte.nombre} className="h-80 w-full rounded-lg border bg-white" />}
      {esAudio(soporte) && soporte.urlMock && <audio controls src={soporte.urlMock} className="w-full" />}
      {t && (
        <div>
          {(esImagen(soporte) || esPdf(soporte) || esAudio(soporte) || soporte.tipoMime.includes('sheet')) && (
            <p className="mb-1.5 flex items-center gap-1 text-xs font-medium text-muted-foreground">
              {esAudio(soporte) || transcripcion ? <><Mic className="size-3" />Transcripción de la IA</> : <><FileText className="size-3" />Texto leído por la IA</>}
            </p>
          )}
          <TextoConEvidencia texto={t} marcas={marcas} activa={activa}
            className={cn('rounded-lg border p-3 text-sm leading-relaxed',
              esChat ? 'max-w-[95%] rounded-tl-none border-emerald-200 bg-emerald-50/70' : soporte.tipoMime.includes('sheet') || soporte.tipoMime === 'text/plain' && soporte.canal === 'whatsapp_export' ? 'bg-muted/40 font-mono text-xs' : 'bg-card')} />
        </div>
      )}
      {!t && !soporte.urlMock && <Vacio titulo="Vista previa no disponible" texto="El archivo está guardado tal como se recibió." />}
    </div>
  )
}

// ---------------- Detalle de un movimiento ----------------
function nombreConcepto(l: LineaLibro, cfg?: Config) {
  const ent = (id?: string) => cfg?.entidades.find((e) => e.id === id)?.nombre ?? '—'
  switch (l.concepto) {
    case 'caja': return `Caja y bancos${l.cuentaId ? ` · ${cfg?.cuentas.find((c) => c.id === l.cuentaId)?.banco ?? ''}` : ''}`
    case 'resultado': return { ingreso: 'Ingreso', costo_venta: 'Costo de ventas', gasto_operativo: 'Gasto operativo', financiero: 'Gasto financiero' }[l.claseResultado!]
    case 'por_cobrar_ic': return `Por cobrar a ${ent(l.contraparteId)}`
    case 'por_pagar_ic': return `Por pagar a ${ent(l.contraparteId)}`
    case 'credito': return 'Deuda del crédito'
    case 'inversion': return 'Inversión en proyecto'
  }
}

export function LineasContables({ lineas, cfg }: { lineas: LineaLibro[]; cfg?: Config }) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs text-muted-foreground"><tr><th className="px-3 py-2 text-left font-medium">Empresa</th><th className="px-3 py-2 text-left font-medium">Concepto</th><th className="px-3 py-2 text-right font-medium">Efecto</th></tr></thead>
        <tbody>
          {lineas.map((l, i) => (
            <tr key={i} className="border-t">
              <td className="px-3 py-2">{cfg?.entidades.find((e) => e.id === l.entidadId)?.nombre}</td>
              <td className="px-3 py-2 text-muted-foreground">{nombreConcepto(l, cfg)}</td>
              <td className="px-3 py-2 text-right"><Money valor={l.monto} signo color={l.concepto === 'caja' || l.concepto === 'resultado'} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DetalleMovimiento({ id }: { id: string }) {
  const { data, cargando } = useConsulta(() => api.movimientos.detalle(id), [id])
  const { data: cfg } = useConsulta(() => api.configuracion.obtener(), [])
  const { puede } = useSesion()
  const [subiendo, setSubiendo] = useState(false)
  if (cargando || !data) return <Cargando filas={6} />
  const { hecho: h, lineas, soportes, bloqueado } = data
  const n = <T extends { id: string; nombre: string }>(arr: T[] | undefined, x?: string) => arr?.find((a) => a.id === x)?.nombre
  const adjuntar = async (f: File) => {
    setSubiendo(true)
    try {
      await api.movimientos.adjuntarSoporte(h.id, { nombre: f.name, tipoMime: f.type || 'application/octet-stream', tamano: f.size, url: f.type.startsWith('image/') && f.size < 900_000 ? await leerDataUrl(f) : '' })
      toast.success('Soporte adjuntado')
    } catch (e) { toast.error((e as Error).message) } finally { setSubiendo(false) }
  }
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Etiqueta tono="azul">{NOMBRE_TIPO[h.tipo]}</Etiqueta>
          {bloqueado && <Etiqueta tono="gris"><Lock />Mes cerrado</Etiqueta>}
          {h.soporteIds.length === 0 && <Etiqueta tono="ambar"><AlertTriangle />Sin soporte</Etiqueta>}
          {h.asignaciones.some((a) => a.entidadId !== h.entidadPagadoraId) && <Etiqueta tono="ambar">Entre empresas</Etiqueta>}
        </div>
        <p className="text-2xl font-semibold"><Money valor={h.monto} /></p>
        <p className="text-sm">{h.descripcion}</p>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {[
          ['Fecha', <Fecha key="f" iso={h.fecha} />],
          ['Paga', n(cfg?.entidades, h.entidadPagadoraId)],
          [h.cuentaDestinoId && !h.cuentaOrigenId ? 'Entra a' : 'Sale de', cfg?.cuentas.find((c) => c.id === (h.cuentaOrigenId ?? h.cuentaDestinoId))?.nombre],
          ...(h.cuentaOrigenId && h.cuentaDestinoId ? [['Entra a', cfg?.cuentas.find((c) => c.id === h.cuentaDestinoId)?.nombre]] : []),
          ['Pertenece a', h.asignaciones.map((a) => `${n(cfg?.entidades, a.entidadId)}${a.proyectoId ? ` · ${n(cfg?.proyectos, a.proyectoId)}` : ''}${h.asignaciones.length > 1 ? ` (${formatCOP(a.monto)})` : ''}`).join(' + ')],
          ['Categoría', n(cfg?.categorias, h.categoriaId) ?? '—'],
          ['Tercero', n(cfg?.terceros, h.terceroId) ?? '—'],
          ['Aprobado por', `${h.aprobadoPor} · ${formatFechaHora(h.aprobadoEn)}`],
        ].map(([k, v], i) => <div key={i} className="min-w-0"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="truncate">{v ?? '—'}</dd></div>)}
      </dl>
      {h.desglosePagoCredito && (
        <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-3 text-sm">
          {(['capital', 'interes', 'cargos'] as const).map((k) => <div key={k}><p className="text-xs text-muted-foreground capitalize">{k === 'interes' ? 'Interés' : k}</p><Money valor={h.desglosePagoCredito![k]} /></div>)}
        </div>
      )}
      <section>
        <h3 className="mb-2 text-sm font-semibold">¿Cómo afecta?</h3>
        <LineasContables lineas={lineas} cfg={cfg} />
        <p className="mt-1.5 text-xs text-muted-foreground">Se registró una sola vez; estas líneas las calcula el sistema.</p>
      </section>
      <section>
        <h3 className="mb-2 text-sm font-semibold">Soporte original</h3>
        {soportes.length ? <div className="space-y-4">{soportes.map((s) => <VisorSoporte key={s.id} soporte={s} />)}</div> : (
          <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50/50 p-4 text-sm">
            <p className="flex items-center gap-2 font-medium text-amber-800"><AlertTriangle className="size-4" />Este movimiento no tiene soporte</p>
            {puede('cargar') && (
              <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border bg-background px-3 py-1.5 text-sm hover:bg-muted">
                <Upload className="size-4" />{subiendo ? 'Adjuntando…' : 'Adjuntar soporte'}
                <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && adjuntar(e.target.files[0])} />
              </label>
            )}
          </div>
        )}
      </section>
    </div>
  )
}

export const leerDataUrl = (f: File) => new Promise<string>((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.readAsDataURL(f) })

function ListaMovimientos({ ids }: { ids: string[] }) {
  const { data, cargando } = useConsulta(() => api.movimientos.listar({ ids }), [ids.join()])
  const { data: cfg } = useConsulta(() => api.configuracion.obtener(), [])
  if (cargando || !data) return <Cargando filas={8} />
  if (!data.length) return <Vacio titulo="Sin movimientos" texto="No hay movimientos aprobados que formen esta cifra." />
  return (
    <ul className="divide-y rounded-lg border">
      {data.map((h) => (
        <li key={h.id}>
          <button onClick={() => abrirMovimiento(h.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-muted/60">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate font-medium">{h.soporteIds.length === 0 && <AlertTriangle className="size-3.5 shrink-0 text-amber-600" />}{h.descripcion}</p>
              <p className="truncate text-xs text-muted-foreground"><Fecha iso={h.fecha} /> · {NOMBRE_TIPO[h.tipo]} · {h.asignaciones.map((a) => cfg?.entidades.find((e) => e.id === a.entidadId)?.nombre).join(', ')}</p>
            </div>
            <Money valor={['ingreso', 'desembolso_credito'].includes(h.tipo) ? h.monto : -h.monto} color />
          </button>
        </li>
      ))}
    </ul>
  )
}

export function PanelesGlobales() {
  const { pila, volver, cerrar } = usePaneles()
  const actual = pila.at(-1)
  return (
    <Sheet open={!!actual} onOpenChange={(o) => !o && cerrar()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl! data-[side=right]:sm:max-w-xl">
        {actual && (
          <>
            <SheetHeader className="border-b pb-3">
              {pila.length > 1 && <Button variant="ghost" size="sm" className="-ml-2 w-fit" onClick={volver}><ArrowLeft />Volver</Button>}
              <SheetTitle>{actual.tipo === 'lista' ? actual.titulo : 'Detalle del movimiento'}</SheetTitle>
              <SheetDescription>{actual.tipo === 'lista' ? actual.subtitulo : 'De la cifra al movimiento y del movimiento a su soporte'}</SheetDescription>
            </SheetHeader>
            <div className="px-4 pb-6">{actual.tipo === 'lista' ? <ListaMovimientos ids={actual.hechoIds} /> : <DetalleMovimiento id={actual.id} />}</div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
