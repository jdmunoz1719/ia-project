// Obligaciones recurrentes, alertas y vencimientos.
import { addDays, differenceInCalendarDays, format, lastDayOfMonth, parseISO } from 'date-fns'
import { estadoCredito } from './amortizacion'
import type { Credito, Hecho, Obligacion, Propuesta, Tarea } from './tipos'

const iso = (d: Date) => format(d, 'yyyy-MM-dd')
export const sumarDias = (fecha: string, dias: number) => iso(addDays(parseISO(fecha), dias))
export const diasEntre = (a: string, b: string) => differenceInCalendarDays(parseISO(b), parseISO(a))

export type Ocurrencia = {
  obligacion: Obligacion; fecha: string; estado: 'cumplida' | 'vencida' | 'pendiente'; hechoId?: string
}

function fechasEnRango(o: Obligacion, desde: string, hasta: string): string[] {
  if (o.recurrencia === 'unica') return o.fecha && o.fecha >= desde && o.fecha <= hasta ? [o.fecha] : []
  const out: string[] = []
  const d0 = parseISO(desde.slice(0, 7) + '-01')
  for (let m = new Date(d0); iso(m) <= hasta; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
    const ym = format(m, 'yyyy-MM')
    const ultimo = Number(format(lastDayOfMonth(m), 'dd'))
    const dia = (d: number) => `${ym}-${String(Math.min(d, ultimo)).padStart(2, '0')}`
    if (o.recurrencia === 'quincenal') out.push(dia(15), dia(30))
    else if (o.recurrencia === 'mensual') out.push(dia(o.diaVencimiento ?? 1))
    else if (o.recurrencia === 'bimestral' && m.getMonth() % 2 === 0) out.push(dia(o.diaVencimiento ?? 1))
    else if (o.recurrencia === 'anual' && o.fecha && Number(o.fecha.slice(5, 7)) === m.getMonth() + 1) out.push(dia(Number(o.fecha.slice(8, 10))))
  }
  return out.filter((f) => f >= desde && f <= hasta)
}

export function ocurrencias(obligaciones: Obligacion[], desde: string, hasta: string, hoy: string): Ocurrencia[] {
  return obligaciones.flatMap((o) => fechasEnRango(o, desde, hasta).map((fecha): Ocurrencia => {
    const c = o.cumplidas.find((x) => Math.abs(diasEntre(x.periodo, fecha)) <= 5)
    return { obligacion: o, fecha, estado: c ? 'cumplida' : fecha < hoy ? 'vencida' : 'pendiente', hechoId: c?.hechoId }
  })).sort((a, b) => a.fecha.localeCompare(b.fecha))
}

export type Alerta = {
  id: string; nivel: 'rojo' | 'ambar'; titulo: string; detalle: string; fecha: string
  entidadId?: string; enlace: string; monto?: number
}

export function calcularAlertas(p: {
  hoy: string; creditos: Credito[]; obligaciones: Obligacion[]; tareas: Tarea[]; hechos: Hecho[]
  pospuestas: Record<string, string>; nombreEntidad: (id: string) => string
}): Alerta[] {
  const { hoy } = p
  const A: Alerta[] = []
  for (const c of p.creditos) {
    const e = estadoCredito(c, hoy)
    for (const f of e.vencidas) A.push({ id: `cuota-${c.id}-${f.numero}`, nivel: 'rojo', titulo: `Cuota ${f.numero} vencida · ${c.nombre}`, detalle: `${p.nombreEntidad(c.entidadId)} · ${c.banco} · venció hace ${diasEntre(f.fecha, hoy)} días`, fecha: f.fecha, entidadId: c.entidadId, enlace: `/creditos/${c.id}`, monto: f.total })
    if (e.proxima && e.proxima.estado === 'futura' && diasEntre(hoy, e.proxima.fecha) <= 7)
      A.push({ id: `cuota-${c.id}-${e.proxima.numero}`, nivel: 'ambar', titulo: `Cuota ${e.proxima.numero} próxima · ${c.nombre}`, detalle: `${p.nombreEntidad(c.entidadId)} · vence en ${diasEntre(hoy, e.proxima.fecha)} días`, fecha: e.proxima.fecha, entidadId: c.entidadId, enlace: `/creditos/${c.id}`, monto: e.proxima.total })
  }
  for (const o of ocurrencias(p.obligaciones, sumarDias(hoy, -30), sumarDias(hoy, 7), hoy)) {
    if (o.estado === 'cumplida') continue
    const vencida = o.estado === 'vencida'
    A.push({ id: `ob-${o.obligacion.id}-${o.fecha}`, nivel: vencida ? 'rojo' : 'ambar', titulo: `${o.obligacion.nombre} ${vencida ? 'vencido' : 'por vencer'}`, detalle: `${p.nombreEntidad(o.obligacion.entidadId)} · ${vencida ? `venció hace ${diasEntre(o.fecha, hoy)} días` : `vence en ${diasEntre(hoy, o.fecha)} días`}`, fecha: o.fecha, entidadId: o.obligacion.entidadId, enlace: '/agenda', monto: o.obligacion.valor })
  }
  for (const t of p.tareas) {
    if (t.hecha) continue
    const d = diasEntre(hoy, t.vence)
    if (d <= 2) A.push({ id: `tarea-${t.id}`, nivel: d < 0 ? 'rojo' : 'ambar', titulo: t.titulo, detalle: d < 0 ? `Tarea vencida hace ${-d} días` : d === 0 ? 'Tarea para hoy' : `Tarea para ${d === 1 ? 'mañana' : `dentro de ${d} días`}`, fecha: t.vence, entidadId: t.entidadId, enlace: '/agenda' })
  }
  const sinSoporte = p.hechos.filter((h) => h.soporteIds.length === 0 && h.fecha >= sumarDias(hoy, -30)).length
  if (sinSoporte) A.push({ id: `sinsoporte-${hoy.slice(0, 7)}`, nivel: 'ambar', titulo: `${sinSoporte} movimientos sin soporte`, detalle: 'Últimos 30 días · adjunta el comprobante', fecha: hoy, enlace: '/movimientos?sinSoporte=1' })

  return A.filter((a) => !(p.pospuestas[a.id] && p.pospuestas[a.id] > hoy))
    .sort((a, b) => (a.nivel === b.nivel ? a.fecha.localeCompare(b.fecha) : a.nivel === 'rojo' ? -1 : 1))
}

export type Vencimiento = { fecha: string; titulo: string; detalle: string; monto?: number; tipo: 'obligacion' | 'cuota' | 'tarea'; enlace: string; vencido: boolean }

export function vencimientos(p: { hoy: string; dias: number; creditos: Credito[]; obligaciones: Obligacion[]; tareas: Tarea[]; nombreEntidad: (id: string) => string }): Vencimiento[] {
  const hasta = sumarDias(p.hoy, p.dias)
  const V: Vencimiento[] = []
  for (const o of ocurrencias(p.obligaciones, p.hoy, hasta, p.hoy)) if (o.estado !== 'cumplida')
    V.push({ fecha: o.fecha, titulo: o.obligacion.nombre, detalle: p.nombreEntidad(o.obligacion.entidadId), monto: o.obligacion.valor, tipo: 'obligacion', enlace: '/agenda', vencido: false })
  for (const c of p.creditos) for (const f of estadoCredito(c, p.hoy).filas)
    if (f.estado !== 'pagada' && f.fecha >= p.hoy && f.fecha <= hasta)
      V.push({ fecha: f.fecha, titulo: `Cuota ${f.numero} · ${c.nombre}`, detalle: `${p.nombreEntidad(c.entidadId)} · ${c.banco}`, monto: f.total, tipo: 'cuota', enlace: `/creditos/${c.id}`, vencido: false })
  for (const t of p.tareas) if (!t.hecha && t.vence >= p.hoy && t.vence <= hasta)
    V.push({ fecha: t.vence, titulo: t.titulo, detalle: t.entidadId ? p.nombreEntidad(t.entidadId) : 'Tarea', tipo: 'tarea', enlace: '/agenda', vencido: false })
  return V.sort((a, b) => a.fecha.localeCompare(b.fecha))
}

/** Pago parecido: mismo monto, misma entidad y fecha a ±3 días de un hecho aprobado. */
export function buscarDuplicado(p: Pick<Propuesta, 'campos'>, hechos: Hecho[]): Hecho | undefined {
  const c = p.campos
  if (!c.monto || !c.fecha) return undefined
  const ents = new Set([c.entidadPagadoraId, ...(c.asignaciones ?? []).map((a) => a.entidadId)].filter(Boolean))
  return hechos.find((h) => h.monto === c.monto && Math.abs(diasEntre(h.fecha, c.fecha!)) <= 3 &&
    (ents.size === 0 || ents.has(h.entidadPagadoraId) || h.asignaciones.some((a) => ents.has(a.entidadId))))
}
