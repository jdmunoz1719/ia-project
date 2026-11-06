// Motor contable base caja: cada Hecho aprobado se expande en LineaLibro[].
// Ninguna pantalla calcula sobre Hecho; todas leen líneas.
import type { Cuenta, Entidad, Hecho, LineaLibro, ClaseResultado, TipoHecho } from './tipos'

const CLASE_POR_TIPO: Partial<Record<TipoHecho, ClaseResultado>> = {
  ingreso: 'ingreso', costo: 'costo_venta', gasto: 'gasto_operativo', interes: 'financiero',
}

/** Dueña de la caja: la entidad pagadora (o la dueña de la cuenta, si se conoce). */
function titular(h: Hecho, cuentas: Map<string, Cuenta>): string {
  const c = h.cuentaOrigenId ?? h.cuentaDestinoId
  return (c && cuentas.get(c)?.entidadId) || h.entidadPagadoraId
}

export function expandirHecho(h: Hecho, cuentasArr: Cuenta[]): LineaLibro[] {
  const cuentas = new Map(cuentasArr.map((c) => [c.id, c]))
  const base = { hechoId: h.id, fecha: h.fecha }
  const L: LineaLibro[] = []
  const T = titular(h, cuentas)
  const unicoProyecto = h.asignaciones.length === 1 ? h.asignaciones[0].proyectoId : undefined

  // Por cada parte asignada a otra entidad: deuda intercompañía.
  // `sentido` = 'T_cobra' cuando T pagó por el otro; 'T_debe' cuando T recibió plata del otro.
  const ic = (otra: string, monto: number, sentido: 'T_cobra' | 'T_debe', proyectoId?: string) => {
    const [acreedor, deudor] = sentido === 'T_cobra' ? [T, otra] : [otra, T]
    L.push({ ...base, entidadId: acreedor, concepto: 'por_cobrar_ic', monto, contraparteId: deudor, proyectoId })
    L.push({ ...base, entidadId: deudor, concepto: 'por_pagar_ic', monto, contraparteId: acreedor, proyectoId })
  }

  switch (h.tipo) {
    case 'gasto': case 'costo': case 'interes': case 'inversion_proyecto': {
      L.push({ ...base, entidadId: T, concepto: 'caja', cuentaId: h.cuentaOrigenId, monto: -h.monto, proyectoId: unicoProyecto })
      for (const a of h.asignaciones) {
        if (h.tipo === 'inversion_proyecto') L.push({ ...base, entidadId: a.entidadId, concepto: 'inversion', monto: a.monto, proyectoId: a.proyectoId })
        else L.push({ ...base, entidadId: a.entidadId, concepto: 'resultado', monto: -a.monto, claseResultado: CLASE_POR_TIPO[h.tipo], proyectoId: a.proyectoId })
        if (a.entidadId !== T) ic(a.entidadId, a.monto, 'T_cobra', a.proyectoId)
      }
      break
    }
    case 'ingreso': {
      L.push({ ...base, entidadId: T, concepto: 'caja', cuentaId: h.cuentaDestinoId, monto: h.monto, proyectoId: unicoProyecto })
      for (const a of h.asignaciones) {
        L.push({ ...base, entidadId: a.entidadId, concepto: 'resultado', monto: a.monto, claseResultado: 'ingreso', proyectoId: a.proyectoId })
        if (a.entidadId !== T) ic(a.entidadId, a.monto, 'T_debe', a.proyectoId)
      }
      break
    }
    case 'traslado': case 'pago_intercompania': {
      const origen = (h.cuentaOrigenId && cuentas.get(h.cuentaOrigenId)?.entidadId) || h.entidadPagadoraId
      const destino = (h.cuentaDestinoId && cuentas.get(h.cuentaDestinoId)?.entidadId) || h.asignaciones[0]?.entidadId || origen
      L.push({ ...base, entidadId: origen, concepto: 'caja', cuentaId: h.cuentaOrigenId, monto: -h.monto })
      L.push({ ...base, entidadId: destino, concepto: 'caja', cuentaId: h.cuentaDestinoId, monto: h.monto })
      if (origen !== destino) {
        // El que paga reduce lo que debe; el que recibe reduce lo que le deben.
        L.push({ ...base, entidadId: origen, concepto: 'por_pagar_ic', monto: -h.monto, contraparteId: destino })
        L.push({ ...base, entidadId: destino, concepto: 'por_cobrar_ic', monto: -h.monto, contraparteId: origen })
      }
      break
    }
    case 'desembolso_credito': {
      const D = h.asignaciones[0]?.entidadId ?? T
      L.push({ ...base, entidadId: T, concepto: 'caja', cuentaId: h.cuentaDestinoId, monto: h.monto })
      L.push({ ...base, entidadId: D, concepto: 'credito', monto: h.monto })
      if (D !== T) ic(D, h.monto, 'T_debe')
      break
    }
    case 'pago_credito': {
      const D = h.asignaciones[0]?.entidadId ?? T
      const d = h.desglosePagoCredito ?? { capital: h.monto, interes: 0, cargos: 0 }
      L.push({ ...base, entidadId: T, concepto: 'caja', cuentaId: h.cuentaOrigenId, monto: -h.monto })
      if (d.capital) L.push({ ...base, entidadId: D, concepto: 'credito', monto: -d.capital })
      if (d.interes + d.cargos) L.push({ ...base, entidadId: D, concepto: 'resultado', monto: -(d.interes + d.cargos), claseResultado: 'financiero' })
      if (D !== T) ic(D, h.monto, 'T_cobra')
      break
    }
  }
  return L
}

export const expandirTodos = (hechos: Hecho[], cuentas: Cuenta[]) => hechos.flatMap((h) => expandirHecho(h, cuentas))

// ---------- Alcance (grupo / entidad / proyecto) ----------
export type Alcance =
  | { tipo: 'grupo'; incluirPersonales: boolean }
  | { tipo: 'entidad'; entidadId: string }
  | { tipo: 'proyecto'; proyectoId: string }

export function filtrarAlcance(lineas: LineaLibro[], alcance: Alcance, entidades: Entidad[]): LineaLibro[] {
  if (alcance.tipo === 'entidad') return lineas.filter((l) => l.entidadId === alcance.entidadId)
  const sinIC = lineas.filter((l) => l.concepto !== 'por_cobrar_ic' && l.concepto !== 'por_pagar_ic')
  if (alcance.tipo === 'proyecto') return sinIC.filter((l) => l.proyectoId === alcance.proyectoId)
  if (alcance.incluirPersonales) return sinIC
  const personales = new Set(entidades.filter((e) => e.esPersonal).map((e) => e.id))
  return sinIC.filter((l) => !personales.has(l.entidadId))
}

export const enRango = (l: { fecha: string }, desde?: string, hasta?: string) =>
  (!desde || l.fecha >= desde) && (!hasta || l.fecha <= hasta)

// ---------- Intercompañías ----------
/** Saldo neto que `deudor` le debe a `acreedor` (positivo = debe). */
export function deudaEntre(lineas: LineaLibro[], deudor: string, acreedor: string): { valor: number; lineas: LineaLibro[] } {
  const ls = lineas.filter((l) => l.concepto === 'por_pagar_ic' &&
    ((l.entidadId === deudor && l.contraparteId === acreedor) || (l.entidadId === acreedor && l.contraparteId === deudor)))
  const valor = ls.reduce((s, l) => s + (l.entidadId === deudor ? l.monto : -l.monto), 0)
  return { valor, lineas: ls }
}

/** Matriz neta: matriz[deudor][acreedor] > 0 sólo en la dirección en que hay deuda. */
export function matrizIntercompania(lineas: LineaLibro[], entidadIds: string[]) {
  const m: Record<string, Record<string, number>> = {}
  for (const d of entidadIds) {
    m[d] = {}
    for (const a of entidadIds) m[d][a] = d === a ? 0 : Math.max(0, deudaEntre(lineas, d, a).valor)
  }
  return m
}

// ---------- Saldos ----------
export function saldoCuenta(cuenta: Cuenta, lineas: LineaLibro[], hasta?: string): number {
  return cuenta.saldoInicial + lineas
    .filter((l) => l.concepto === 'caja' && l.cuentaId === cuenta.id && (!hasta || l.fecha <= hasta))
    .reduce((s, l) => s + l.monto, 0)
}

export const suma = (ls: LineaLibro[]) => ls.reduce((s, l) => s + l.monto, 0)
