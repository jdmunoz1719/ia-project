// Indicadores base caja. Cada uno devuelve el valor, las líneas que lo forman (para el detalle)
// y cuántas propuestas pendientes lo afectarían.
import type { Cuenta, Entidad, LineaLibro, Propuesta, Proyecto } from './tipos'
import { type Alcance, enRango, filtrarAlcance, suma } from './libro'

export type Indicador = { valor: number; lineas: LineaLibro[]; pendientesPorAprobar: number }
export type ClaveIndicador =
  | 'ingresos' | 'utilidadBruta' | 'resultadoOperativo' | 'resultadoFinal'
  | 'flujoCaja' | 'inversionProyectos' | 'saldoCaja'

export const NOMBRE_INDICADOR: Record<ClaveIndicador, string> = {
  ingresos: 'Ingresos', utilidadBruta: 'Utilidad bruta', resultadoOperativo: 'Resultado operativo',
  resultadoFinal: 'Resultado final', flujoCaja: 'Flujo de caja', inversionProyectos: 'Inversión en proyectos',
  saldoCaja: 'Saldo de caja y bancos',
}

export type Contexto = { entidades: Entidad[]; cuentas: Cuenta[]; proyectos: Proyecto[]; pendientes: Propuesta[] }

/** Entidades que cubre un alcance (para saldos iniciales y avisos de pendientes). */
function entidadesDe(alcance: Alcance, ctx: Contexto): Set<string> {
  if (alcance.tipo === 'entidad') return new Set([alcance.entidadId])
  if (alcance.tipo === 'proyecto') return new Set(ctx.proyectos.filter((p) => p.id === alcance.proyectoId).map((p) => p.entidadId))
  return new Set(ctx.entidades.filter((e) => alcance.incluirPersonales || !e.esPersonal).map((e) => e.id))
}

/** Propuestas pendientes (no tareas) cuya fecha cae en el rango y que tocan el alcance. */
export function pendientesEnAlcance(alcance: Alcance, ctx: Contexto, desde?: string, hasta?: string): Propuesta[] {
  const ents = entidadesDe(alcance, ctx)
  return ctx.pendientes.filter((p) => {
    if (p.estado !== 'pendiente' || p.tipo === 'tarea') return false
    const c = p.campos
    if (c.fecha && !enRango({ fecha: c.fecha }, desde, hasta)) return false
    if (alcance.tipo === 'proyecto') return !!c.asignaciones?.some((a) => a.proyectoId === alcance.proyectoId)
    const toca = [c.entidadPagadoraId, ...(c.asignaciones ?? []).map((a) => a.entidadId)].filter(Boolean) as string[]
    return toca.length === 0 || toca.some((e) => ents.has(e))
  })
}

/** Agrupa las líneas de caja por hecho y separa entradas/salidas netas (los movimientos internos se anulan). */
function flujoNeto(cajas: LineaLibro[]) {
  const porHecho = new Map<string, number>()
  for (const l of cajas) porHecho.set(l.hechoId, (porHecho.get(l.hechoId) ?? 0) + l.monto)
  let entradas = 0, salidas = 0
  for (const v of porHecho.values()) {
    if (v > 0) entradas += v
    else salidas -= v
  }
  const hechosConFlujo = new Set([...porHecho].filter(([, v]) => v !== 0).map(([k]) => k))
  return { entradas, salidas, lineas: cajas.filter((l) => hechosConFlujo.has(l.hechoId)) }
}

export function calcularIndicadores(
  lineasTodas: LineaLibro[], alcance: Alcance, ctx: Contexto, desde?: string, hasta?: string,
): Record<ClaveIndicador, Indicador> & { entradas: number; salidas: number } {
  const enAlcance = filtrarAlcance(lineasTodas, alcance, ctx.entidades)
  const ls = enAlcance.filter((l) => enRango(l, desde, hasta))
  const res = (clases: string[]) => ls.filter((l) => l.concepto === 'resultado' && clases.includes(l.claseResultado!))
  const pend = pendientesEnAlcance(alcance, ctx, desde, hasta).length

  const ing = res(['ingreso'])
  const bruta = res(['ingreso', 'costo_venta'])
  const oper = res(['ingreso', 'costo_venta', 'gasto_operativo'])
  const fin = res(['ingreso', 'costo_venta', 'gasto_operativo', 'financiero'])
  const flujo = flujoNeto(ls.filter((l) => l.concepto === 'caja'))
  const inv = ls.filter((l) => l.concepto === 'inversion')

  // Saldo: saldos iniciales de las cuentas del alcance + todo el movimiento de caja hasta la fecha.
  const ents = entidadesDe(alcance, ctx)
  const inicial = alcance.tipo === 'proyecto' ? 0 : ctx.cuentas.filter((c) => ents.has(c.entidadId)).reduce((s, c) => s + c.saldoInicial, 0)
  const cajaHasta = enAlcance.filter((l) => l.concepto === 'caja' && (!hasta || l.fecha <= hasta))

  const ind = (lineas: LineaLibro[], valor = suma(lineas)): Indicador => ({ valor, lineas, pendientesPorAprobar: pend })
  return {
    ingresos: ind(ing),
    utilidadBruta: ind(bruta),
    resultadoOperativo: ind(oper),
    resultadoFinal: ind(fin),
    flujoCaja: ind(flujo.lineas, flujo.entradas - flujo.salidas),
    inversionProyectos: ind(inv),
    saldoCaja: ind(cajaHasta, inicial + suma(cajaHasta)),
    entradas: flujo.entradas,
    salidas: flujo.salidas,
  }
}

/** Ingresos vs egresos (salidas de caja) por mes, para la gráfica. */
export function serieMensual(lineasTodas: LineaLibro[], alcance: Alcance, ctx: Contexto, meses: string[]) {
  return meses.map((mes) => {
    const r = calcularIndicadores(lineasTodas, alcance, ctx, `${mes}-01`, `${mes}-31`)
    return { mes, ingresos: r.entradas, egresos: r.salidas, resultado: r.resultadoFinal.valor }
  })
}

/** Suma por entidad (para la tabla del grupo). */
export function resumenPorEntidad(lineasTodas: LineaLibro[], ctx: Contexto, desde?: string, hasta?: string) {
  return ctx.entidades.map((e) => {
    const r = calcularIndicadores(lineasTodas, { tipo: 'entidad', entidadId: e.id }, ctx, desde, hasta)
    return { entidad: e, ingresos: r.ingresos.valor, resultadoFinal: r.resultadoFinal.valor, flujoCaja: r.flujoCaja.valor, saldoCaja: r.saldoCaja.valor }
  })
}
