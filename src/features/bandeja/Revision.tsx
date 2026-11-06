import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  AlertTriangle, ArrowDownLeft, ArrowLeft, ArrowLeftRight, ArrowUpRight, Check, CheckCircle2, Copy, Eye, ListPlus, Loader2,
  Plus, RefreshCw, Sparkles, SplitSquareHorizontal, Trash2, Undo2, X, XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Campo, Cargando, Confianza, Etiqueta, Fecha, InputDinero, InputFecha, Money, Selector, Vacio } from '@/components/comunes'
import { abrirMovimiento, IconoCanal, VisorSoporte, type Marca } from '@/components/paneles'
import { useConsulta } from '@/hooks/useConsulta'
import { useSesion } from '@/hooks/useSesion'
import { api, NOMBRE_TIPO, type Config } from '@/services/api'
import type { CamposPropuesta, Propuesta, TipoHecho } from '@/domain/tipos'
import { formatFechaHora } from '@/lib/format'
import { cn } from '@/lib/utils'

const TIPOS: (TipoHecho | 'tarea')[] = ['gasto', 'costo', 'ingreso', 'interes', 'inversion_proyecto', 'traslado', 'pago_intercompania', 'pago_credito', 'desembolso_credito', 'tarea']
const CLASES: Record<string, string[]> = {
  ingreso: ['ingreso'], gasto: ['gasto_operativo', 'financiero'], costo: ['costo_venta'], interes: ['financiero'],
  inversion_proyecto: ['inversion'], pago_credito: ['financiero'], tarea: ['gasto_operativo', 'costo_venta', 'financiero'],
}
const ENTRADA = ['ingreso', 'desembolso_credito']

export default function Revision() {
  const { id = '' } = useParams()
  const { data, cargando, error } = useConsulta(() => api.bandeja.obtener(id), [id])
  const { data: cfg } = useConsulta(() => api.configuracion.obtener(), [])
  const [activa, setActiva] = useState<string | null>(null)
  const [tab, setTab] = useState<'revision' | 'historial'>('revision')
  const { puede } = useSesion()

  if (error) return <Vacio titulo="No se encontró el elemento" texto="Puede que se haya reiniciado la demo." />
  if (cargando || !data || !cfg) return <Cargando filas={8} />
  const { item, soporte, historial, originalDuplicado } = data
  const marcas: Marca[] = item.propuestas.flatMap((p) => p.evidencia.map((e) => ({ ...e, clave: `${p.id}:${e.campo}` })))
  const pendientes = item.propuestas.filter((p) => p.estado === 'pendiente').length
  const procesando = item.estado === 'procesando'

  const accion = async (fn: () => Promise<unknown>, ok?: string) => { try { await fn(); if (ok) toast.success(ok) } catch (e) { toast.error((e as Error).message) } }

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="icon" nativeButton={false} render={<Link to="/bandeja" />} aria-label="Volver a la bandeja"><ArrowLeft /></Button>
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted"><IconoCanal canal={item.canal} /></span>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold">{soporte.nombre}</h1>
            <p className="text-xs text-muted-foreground">Recibido el {formatFechaHora(item.recibidoEn)} · {procesando ? 'la IA está leyendo…' : `${item.propuestas.length} propuesta(s), ${pendientes} por revisar`}</p>
          </div>
        </div>
        {puede('cargar') && (
          <div className="flex flex-wrap gap-2 sm:ml-auto">
            <Button variant="outline" size="sm" disabled={procesando} onClick={() => accion(() => api.bandeja.releer(item.id), 'La IA está leyendo de nuevo')}><RefreshCw />Volver a leer</Button>
            <Button variant="outline" size="sm" disabled={procesando} onClick={() => accion(() => api.bandeja.agregarManual(item.id, 'registro'))}><Plus />Registro</Button>
            <Button variant="outline" size="sm" disabled={procesando} onClick={() => accion(() => api.bandeja.agregarManual(item.id, 'tarea'))}><ListPlus />Tarea</Button>
          </div>
        )}
      </div>

      {originalDuplicado && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          <Copy className="size-4" /><span><b>Archivo repetido:</b> este mismo archivo ya se recibió el {formatFechaHora(originalDuplicado.recibidoEn)}.</span>
          <Link to={`/bandeja/${originalDuplicado.itemId}`} className="font-medium underline">Posible duplicado de… ver el original</Link>
        </div>
      )}

      <div className="mb-4 flex gap-1 border-b text-sm">
        {(['revision', 'historial'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn('-mb-px border-b-2 px-3 py-2', tab === t ? 'border-primary font-medium text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
            {t === 'revision' ? 'Revisión' : `Historial (${historial.length})`}
          </button>
        ))}
      </div>

      {tab === 'historial' ? (
        historial.length ? (
          <ol className="relative space-y-4 border-l pl-6">
            {historial.map((h, i) => (
              <li key={i} className="text-sm">
                <span className="absolute -left-1.5 mt-1 size-3 rounded-full border-2 border-background bg-primary" />
                <p><b>{h.usuario}</b> · {h.accion} <span className="text-muted-foreground">— {h.objeto}</span></p>
                <p className="text-xs text-muted-foreground">{formatFechaHora(h.fecha)}{h.detalle && ` · ${h.detalle}`}</p>
              </li>
            ))}
          </ol>
        ) : <Vacio titulo="Sin actividad registrada" texto="Este elemento venía en los datos iniciales de la demo." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="lg:sticky lg:top-20 lg:self-start">
            <h2 className="mb-2 text-sm font-semibold">Original</h2>
            <div className="rounded-xl border bg-card p-4 lg:max-h-[calc(100svh-11rem)] lg:overflow-y-auto">
              <VisorSoporte soporte={soporte} texto={item.textoExtraido} marcas={marcas} activa={activa} transcripcion={item.transcripcion} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Pase el cursor por un campo de la propuesta para ver de dónde salió el dato.</p>
          </section>
          <section className="space-y-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="size-4 text-primary" />Lo que propone la IA</h2>
            {procesando ? <Leyendo /> : item.propuestas.map((p, i) => (
              <TarjetaPropuesta key={`${p.id}:${p.estado}`} n={i + 1} itemId={item.id} p={p} cfg={cfg} onHover={setActiva} />
            ))}
          </section>
        </div>
      )}
    </div>
  )
}

const PASOS_IA = ['Leyendo el contenido original', 'Identificando montos y fechas', 'Reconociendo empresas, cuentas y proyectos', 'Proponiendo registros']

function Leyendo() {
  const [n, setN] = useState(0)
  useEffect(() => { const t = setInterval(() => setN((x) => Math.min(x + 1, PASOS_IA.length - 1)), 600); return () => clearInterval(t) }, [])
  return (
    <div className="rounded-xl border bg-card p-5">
      <p className="mb-4 flex items-center gap-2 text-sm font-medium"><Loader2 className="size-4 animate-spin text-primary" />La IA está leyendo…</p>
      <ol className="space-y-2 text-sm">
        {PASOS_IA.map((p, i) => <li key={p} className={cn('flex items-center gap-2 transition', i > n && 'opacity-40')}>{i < n ? <Check className="size-4 text-emerald-600" /> : i === n ? <Loader2 className="size-4 animate-spin" /> : <span className="size-4" />}{p}</li>)}
      </ol>
      <div className="mt-5 space-y-2"><div className="h-3 w-2/3 animate-pulse rounded bg-muted" /><div className="h-3 w-1/2 animate-pulse rounded bg-muted" /></div>
    </div>
  )
}

function TarjetaPropuesta({ n, itemId, p, cfg, onHover }: { n: number; itemId: string; p: Propuesta; cfg: Config; onHover: (c: string | null) => void }) {
  const [tipo, setTipo] = useState<TipoHecho | 'tarea'>(p.tipo)
  const [c, setC] = useState<CamposPropuesta>(() => structuredClone(p.campos))
  const [efecto, setEfecto] = useState<Awaited<ReturnType<typeof api.bandeja.efecto>>>()
  const [ocupado, setOcupado] = useState(false)
  const { puede } = useSesion()
  const cambiado = tipo !== p.tipo || JSON.stringify(c) !== JSON.stringify(p.campos)
  const abierta = p.estado === 'pendiente'
  const esTarea = tipo === 'tarea'

  useEffect(() => { if (!esTarea && abierta) api.bandeja.efecto(tipo as TipoHecho, c).then(setEfecto) }, [tipo, c, esTarea, abierta])

  const upd = (x: Partial<CamposPropuesta>) => setC((v) => ({ ...v, ...x }))
  const h = (campo: string) => ({ onMouseEnter: () => onHover(`${p.id}:${campo}`), onMouseLeave: () => onHover(null), onFocus: () => onHover(`${p.id}:${campo}`), onBlur: () => onHover(null) })
  const asig = c.asignaciones ?? []
  const repartido = asig.length > 1
  const setMonto = (m?: number) => upd({ monto: m, asignaciones: asig.length === 1 ? [{ ...asig[0], monto: m ?? 0 }] : asig })
  const setDuena = (entidadId: string) => upd({ asignaciones: entidadId ? [{ entidadId, monto: c.monto ?? 0 }] : [] })
  const ctaEntrada = ENTRADA.includes(tipo)
  const cuentaKey = ctaEntrada ? 'cuentaDestinoId' : 'cuentaOrigenId'
  const setCuenta = (id: string) => {
    const ent = cfg.cuentas.find((x) => x.id === id)?.entidadId
    upd({ [cuentaKey]: id || undefined, entidadPagadoraId: ent ?? c.entidadPagadoraId, asignaciones: asig.length ? asig : ent ? [{ entidadId: ent, monto: c.monto ?? 0 }] : [] })
  }
  const opcCuentas = cfg.cuentas.map((x) => ({ value: x.id, label: x.nombre, grupo: cfg.entidades.find((e) => e.id === x.entidadId)?.nombre }))
  const opcEntidades = cfg.entidades.map((e) => ({ value: e.id, label: e.nombre }))
  const opcProyectos = (ent?: string) => cfg.proyectos.filter((x) => x.entidadId === ent).map((x) => ({ value: x.id, label: x.nombre }))
  const opcCategorias = cfg.categorias.filter((x) => (CLASES[tipo] ?? []).includes(x.clase)).map((x) => ({ value: x.id, label: x.nombre }))
  const ic = !esTarea && c.entidadPagadoraId && asig.some((a) => a.entidadId && a.entidadId !== c.entidadPagadoraId)

  const prellenarCuota = async () => {
    if (!c.creditoId) return
    const d = await api.creditos.detalle(c.creditoId)
    if (!d.proxima) return toast.info('El crédito no tiene cuotas pendientes')
    const f = d.proxima
    upd({ numeroCuota: f.numero, monto: f.total, desglosePagoCredito: { capital: f.capital, interes: f.interes, cargos: f.cargos }, cuentaOrigenId: c.cuentaOrigenId ?? d.credito.cuentaId, entidadPagadoraId: c.entidadPagadoraId ?? d.credito.entidadId, asignaciones: [{ entidadId: d.credito.entidadId, monto: f.total }] })
  }

  const ejecutar = async (fn: () => Promise<unknown>, ok: string, ver?: (r: unknown) => void) => {
    setOcupado(true)
    try { const r = await fn(); toast.success(ok, ver ? { action: { label: 'Ver', onClick: () => ver(r) } } : undefined) } catch (e) { toast.error((e as Error).message) } finally { setOcupado(false) }
  }
  const aprobar = () => ejecutar(() => api.bandeja.aprobar(itemId, p.id, c, tipo, cambiado), esTarea ? 'Tarea creada' : 'Movimiento aprobado',
    (r) => { const x = r as { tipo: string; id: string }; if (x.tipo === 'hecho') abrirMovimiento(x.id) })

  if (!abierta) {
    const tono = p.estado === 'aprobada' || p.estado === 'corregida' ? 'verde' : p.estado === 'duplicado' ? 'ambar' : 'gris'
    const etiqueta = { aprobada: 'Aprobada', corregida: 'Corregida y aprobada', descartada: 'Descartada', rechazada: 'Rechazada', duplicado: 'Marcada como duplicado', pendiente: '' }[p.estado]
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-muted/30 px-4 py-3 text-sm" {...h('monto')}>
        <span className="num text-xs text-muted-foreground">#{n}</span>
        <Etiqueta tono={tono}>{tono === 'verde' ? <CheckCircle2 /> : <XCircle />}{etiqueta}</Etiqueta>
        <span className="font-medium">{NOMBRE_TIPO[p.tipo]}</span>
        <span className="min-w-0 flex-1 truncate text-muted-foreground">{p.campos.tituloTarea ?? p.campos.descripcion}</span>
        {p.campos.monto ? <Money valor={p.campos.monto} className="font-medium" /> : null}
        {p.hechoId && <Button size="xs" variant="outline" onClick={() => abrirMovimiento(p.hechoId!)}><Eye />Ver movimiento</Button>}
        {['descartada', 'rechazada', 'duplicado'].includes(p.estado) && puede('aprobar') && <Button size="xs" variant="ghost" onClick={() => ejecutar(() => api.bandeja.cambiarEstado(itemId, p.id, 'pendiente'), 'Propuesta reabierta')}><Undo2 />Reabrir</Button>}
      </div>
    )
  }

  return (
    <article className={cn('rounded-xl border bg-card shadow-sm', p.posibleDuplicadoDe && 'border-amber-300')}>
      <header className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <span className="num text-xs text-muted-foreground">#{n}</span>
        <span className="font-semibold">{NOMBRE_TIPO[tipo]}</span>
        {ic && <Etiqueta tono="ambar"><ArrowLeftRight />Entre empresas</Etiqueta>}
        {repartido && <Etiqueta tono="azul"><SplitSquareHorizontal />Repartido</Etiqueta>}
        {cambiado && <Etiqueta tono="azul">Corregida</Etiqueta>}
        <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">Confianza <Confianza valor={p.confianza} /></span>
      </header>

      <div className="space-y-4 p-4">
        {p.posibleDuplicadoDe && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <Copy className="size-4" />Posible duplicado de un movimiento ya aprobado
            <button className="font-medium underline" onClick={() => abrirMovimiento(p.posibleDuplicadoDe!)}>ver el original</button>
          </div>
        )}
        {p.nota && <p className="flex items-start gap-1.5 text-xs text-amber-800"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" />{p.nota}</p>}

        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Tipo"><Selector value={tipo} onChange={(e) => setTipo(e.target.value as TipoHecho)} opciones={TIPOS.map((t) => ({ value: t, label: NOMBRE_TIPO[t] }))} /></Campo>
          {esTarea ? (
            <>
              <div {...h('vence')}><Campo etiqueta="Vence"><InputFecha valor={c.vence} onChange={(v) => upd({ vence: v })} /></Campo></div>
              <div className="col-span-2" {...h('descripcion')}><Campo etiqueta="Tarea"><Input value={c.tituloTarea ?? ''} onChange={(e) => upd({ tituloTarea: e.target.value })} /></Campo></div>
              <div {...h('entidadId')}><Campo etiqueta="Empresa"><Selector value={asig[0]?.entidadId ?? ''} onChange={(e) => setDuena(e.target.value)} opciones={opcEntidades} vacio="(Sin empresa)" /></Campo></div>
              <Campo etiqueta="Crédito vinculado"><Selector value={c.creditoId ?? ''} onChange={(e) => upd({ creditoId: e.target.value || undefined })} opciones={cfg.creditos.map((x) => ({ value: x.id, label: x.nombre }))} vacio="(Ninguno)" /></Campo>
            </>
          ) : (
            <>
              <div {...h('monto')}><Campo etiqueta="Monto"><InputDinero valor={c.monto} onChange={setMonto} /></Campo></div>
              <div {...h('fecha')}><Campo etiqueta="Fecha"><InputFecha valor={c.fecha} onChange={(v) => upd({ fecha: v })} /></Campo></div>
              <div {...h(cuentaKey)}><Campo etiqueta={ctaEntrada ? 'Entra a la cuenta' : tipo === 'traslado' || tipo === 'pago_intercompania' ? 'Sale de la cuenta' : 'Sale de la cuenta (paga)'}>
                <Selector value={c[cuentaKey] ?? ''} onChange={(e) => setCuenta(e.target.value)} opciones={opcCuentas} vacio="(Elegir cuenta)" /></Campo></div>
              {(tipo === 'traslado' || tipo === 'pago_intercompania') ? (
                <div {...h('cuentaDestinoId')}><Campo etiqueta="Entra a la cuenta"><Selector value={c.cuentaDestinoId ?? ''} onChange={(e) => upd({ cuentaDestinoId: e.target.value || undefined })} opciones={opcCuentas} vacio="(Elegir cuenta)" /></Campo></div>
              ) : !repartido ? (
                <div {...h('entidadId')}><Campo etiqueta={ctaEntrada ? 'Ingreso de la empresa' : 'Gasto de la empresa'}><Selector value={asig[0]?.entidadId ?? ''} onChange={(e) => setDuena(e.target.value)} opciones={opcEntidades} vacio="(Sin identificar)" /></Campo></div>
              ) : <div />}
              {!repartido && !(tipo === 'traslado' || tipo === 'pago_intercompania') && (
                <div {...h('proyectoId')}><Campo etiqueta="Proyecto"><Selector value={asig[0]?.proyectoId ?? ''} disabled={!asig[0]} onChange={(e) => upd({ asignaciones: [{ ...asig[0], proyectoId: e.target.value || undefined }] })} opciones={opcProyectos(asig[0]?.entidadId)} vacio="(Ninguno)" /></Campo></div>
              )}
              {opcCategorias.length > 0 && <div {...h('categoriaId')}><Campo etiqueta="Categoría"><Selector value={c.categoriaId ?? ''} onChange={(e) => upd({ categoriaId: e.target.value || undefined })} opciones={opcCategorias} vacio="(Sin categoría)" /></Campo></div>}
              <div {...h('terceroId')}><Campo etiqueta="Tercero"><Selector value={c.terceroId ?? ''} onChange={(e) => upd({ terceroId: e.target.value || undefined })} opciones={cfg.terceros.map((x) => ({ value: x.id, label: x.nombre }))} vacio="(Ninguno)" /></Campo></div>
              {(tipo === 'pago_credito' || tipo === 'desembolso_credito') && (
                <Campo etiqueta="Crédito"><Selector value={c.creditoId ?? ''} onChange={(e) => upd({ creditoId: e.target.value || undefined })} opciones={cfg.creditos.map((x) => ({ value: x.id, label: `${x.nombre} · ${x.banco}` }))} vacio="(Elegir crédito)" /></Campo>
              )}
              <div className="col-span-2" {...h('descripcion')}><Campo etiqueta="Descripción"><Input value={c.descripcion ?? ''} onChange={(e) => upd({ descripcion: e.target.value })} /></Campo></div>
            </>
          )}
        </div>

        {tipo === 'pago_credito' && (
          <div className="rounded-lg bg-muted/40 p-3">
            <div className="mb-2 flex items-center justify-between"><p className="text-xs font-medium">Desglose del pago {c.numeroCuota ? `· cuota ${c.numeroCuota}` : ''}</p><Button size="xs" variant="outline" disabled={!c.creditoId} onClick={prellenarCuota}>Prellenar desde la tabla</Button></div>
            <div className="grid grid-cols-3 gap-2">
              {(['capital', 'interes', 'cargos'] as const).map((k) => (
                <Campo key={k} etiqueta={k === 'interes' ? 'Interés' : k[0].toUpperCase() + k.slice(1)}>
                  <InputDinero valor={c.desglosePagoCredito?.[k]} onChange={(v) => upd({ desglosePagoCredito: { capital: 0, interes: 0, cargos: 0, ...c.desglosePagoCredito, [k]: v ?? 0 } })} />
                </Campo>
              ))}
            </div>
          </div>
        )}

        {!esTarea && !(tipo === 'traslado' || tipo === 'pago_intercompania') && (
          <Reparto c={c} cfg={cfg} upd={upd} opcProyectos={opcProyectos} />
        )}

        {!esTarea && efecto && (
          <div className={cn('rounded-lg border p-3', ic || repartido ? 'border-amber-200 bg-amber-50/40' : 'bg-muted/30')}>
            <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Vista previa del efecto</p>
            {efecto.errores.length ? (
              <ul className="space-y-1 text-sm text-amber-800">{efecto.errores.map((e) => <li key={e} className="flex items-center gap-1.5"><AlertTriangle className="size-3.5" />{e}</li>)}</ul>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {efecto.frases.map((f, i) => (
                  <li key={i} className={cn('flex items-center gap-2', f.tono === 'ic' && 'font-medium text-amber-900')}>
                    {f.tono === 'salida' ? <ArrowUpRight className="size-4 text-red-600" /> : f.tono === 'entrada' ? <ArrowDownLeft className="size-4 text-emerald-600" /> : f.tono === 'ic' ? <ArrowLeftRight className="size-4 text-amber-600" /> : <Check className="size-4 text-muted-foreground" />}
                    {f.texto}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-[11px] text-muted-foreground">Nada de esto afecta saldos ni informes hasta que se apruebe.</p>
          </div>
        )}
      </div>

      <footer className="flex flex-wrap items-center gap-2 border-t px-4 py-3">
        <Acciones puede={puede('aprobar')}>
          <Button onClick={aprobar} disabled={ocupado || !puede('aprobar') || (!esTarea && !!efecto?.errores.length)} className="bg-emerald-600 text-white hover:bg-emerald-700">
            {ocupado ? <Loader2 className="animate-spin" /> : <Check />}{cambiado ? 'Corregir y aprobar' : 'Aprobar'}
          </Button>
          <Button variant="outline" disabled={ocupado || !puede('aprobar')} onClick={() => ejecutar(() => api.bandeja.cambiarEstado(itemId, p.id, 'descartada'), 'Propuesta descartada')}><X />Descartar</Button>
          <Button variant="ghost" disabled={ocupado || !puede('aprobar')} onClick={() => ejecutar(() => api.bandeja.cambiarEstado(itemId, p.id, 'rechazada'), 'Propuesta rechazada')}><XCircle />Rechazar</Button>
          <Button variant="ghost" disabled={ocupado || !puede('aprobar')} onClick={() => ejecutar(() => api.bandeja.cambiarEstado(itemId, p.id, 'duplicado'), 'Marcada como duplicado')}><Copy />Duplicado</Button>
        </Acciones>
        {cambiado && <Button variant="ghost" size="sm" className="ml-auto" onClick={() => { setTipo(p.tipo); setC(structuredClone(p.campos)) }}><Undo2 />Deshacer cambios</Button>}
      </footer>
    </article>
  )
}

function Acciones({ puede, children }: { puede: boolean; children: ReactNode }) {
  return (
    <>
      {children}
      {!puede && <span className="w-full text-xs text-muted-foreground">Tu rol puede cargar y corregir, pero no aprobar. Un administrador debe aprobarla.</span>}
    </>
  )
}

/** Reparto de un gasto o ingreso entre varias empresas (por valor o por porcentaje). */
function Reparto({ c, cfg, upd, opcProyectos }: { c: CamposPropuesta; cfg: Config; upd: (x: Partial<CamposPropuesta>) => void; opcProyectos: (e?: string) => { value: string; label: string }[] }) {
  const asig = useMemo(() => c.asignaciones ?? [], [c.asignaciones])
  const total = c.monto ?? 0
  if (asig.length <= 1) {
    return (
      <button className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline disabled:opacity-50" disabled={!asig.length || !total}
        onClick={() => { const mitad = Math.round(total / 2); upd({ asignaciones: [{ ...asig[0], monto: total - mitad }, { entidadId: '', monto: mitad }] }) }}>
        <SplitSquareHorizontal className="size-3.5" />Repartir entre varias empresas
      </button>
    )
  }
  const set = (i: number, x: Partial<(typeof asig)[number]>) => upd({ asignaciones: asig.map((a, j) => (j === i ? { ...a, ...x } : a)) })
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex items-center justify-between"><p className="text-xs font-semibold">Reparto</p>
        <button className="text-xs text-primary hover:underline" onClick={() => { const base = Math.floor(total / asig.length); upd({ asignaciones: asig.map((a, i) => ({ ...a, monto: i === asig.length - 1 ? total - base * (asig.length - 1) : base })) }) }}>Partes iguales</button>
      </div>
      {asig.map((a, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_110px_64px_24px] items-center gap-2">
          <Selector value={a.entidadId} onChange={(e) => set(i, { entidadId: e.target.value, proyectoId: undefined })} opciones={cfg.entidades.map((e) => ({ value: e.id, label: e.nombre }))} vacio="Empresa" />
          <Selector value={a.proyectoId ?? ''} onChange={(e) => set(i, { proyectoId: e.target.value || undefined })} opciones={opcProyectos(a.entidadId)} vacio="Proyecto" />
          <InputDinero valor={a.monto} onChange={(v) => set(i, { monto: v ?? 0 })} />
          <div className="relative">
            <input inputMode="decimal" aria-label="Porcentaje" className="num h-8 w-full rounded-lg border border-input bg-background pr-5 pl-1 text-right text-sm"
              value={total ? String(Math.round((a.monto / total) * 1000) / 10).replace('.', ',') : ''}
              onChange={(e) => { const pct = parseFloat(e.target.value.replace(',', '.')); if (!isNaN(pct)) set(i, { monto: Math.round((total * pct) / 100) }) }} />
            <span className="absolute top-1/2 right-1.5 -translate-y-1/2 text-xs text-muted-foreground">%</span>
          </div>
          <button onClick={() => upd({ asignaciones: asig.filter((_, j) => j !== i) })} aria-label="Quitar" className="text-muted-foreground hover:text-red-600"><Trash2 className="size-4" /></button>
        </div>
      ))}
      <button className="flex items-center gap-1 text-xs text-primary hover:underline" onClick={() => upd({ asignaciones: [...asig, { entidadId: '', monto: 0 }] })}><Plus className="size-3" />Agregar empresa</button>
      <p className="text-xs text-muted-foreground">Total: <Money valor={total} /> · <Fecha iso={c.fecha} /></p>
    </div>
  )
}
