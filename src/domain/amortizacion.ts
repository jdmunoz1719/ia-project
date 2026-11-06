// Amortización de créditos con cuota fija (sistema francés).
import { addMonths, format, parseISO } from 'date-fns'
import type { Credito, TipoTasa } from './tipos'

export const tasaMensual = (t: { valor: number; tipo: TipoTasa }) =>
  t.tipo === 'EA' ? Math.pow(1 + t.valor, 1 / 12) - 1 : t.valor

export const cuotaFinanciera = (P: number, i: number, n: number) =>
  i === 0 ? Math.round(P / n) : Math.round((P * i) / (1 - Math.pow(1 + i, -n)))

export type FilaAmortizacion = {
  numero: number; fecha: string; cuotaFinanciera: number; interes: number; capital: number
  cargos: number; total: number; saldo: number; tasaMensual: number
}

export const fechaCuota = (primeraFecha: string, k: number) =>
  format(addMonths(parseISO(primeraFecha), k - 1), 'yyyy-MM-dd')

type CondicionesCredito = Pick<Credito, 'monto' | 'tasa' | 'numCuotas' | 'primeraFecha' | 'cargosPorCuota'> & { cambios?: Credito['cambios'] }

/** Tabla completa. Los cambios (tasa nueva, abono extra) se aplican desde la primera cuota con fecha >= al cambio y recalculan la cuota manteniendo el plazo. */
export function tablaAmortizacion(c: CondicionesCredito): FilaAmortizacion[] {
  let i = tasaMensual(c.tasa)
  let saldo = c.monto
  let cuota = cuotaFinanciera(saldo, i, c.numCuotas)
  const cambios = [...(c.cambios ?? [])].sort((a, b) => a.fecha.localeCompare(b.fecha))
  let ci = 0
  const filas: FilaAmortizacion[] = []
  for (let k = 1; k <= c.numCuotas; k++) {
    const fecha = fechaCuota(c.primeraFecha, k)
    let recalcular = false
    while (ci < cambios.length && cambios[ci].fecha <= fecha) {
      const cb = cambios[ci++]
      if (cb.tipo === 'tasa') i = tasaMensual({ valor: cb.valor, tipo: c.tasa.tipo })
      else saldo = Math.max(0, saldo - cb.valor)
      recalcular = true
    }
    if (recalcular) cuota = cuotaFinanciera(saldo, i, c.numCuotas - k + 1)
    const interes = Math.round(saldo * i)
    const ultima = k === c.numCuotas
    const capital = ultima ? saldo : Math.min(saldo, cuota - interes)
    saldo -= capital
    filas.push({
      numero: k, fecha, cuotaFinanciera: capital + interes, interes, capital,
      cargos: c.cargosPorCuota, total: capital + interes + c.cargosPorCuota, saldo, tasaMensual: i,
    })
  }
  return filas
}

export type EstadoCuota = 'pagada' | 'vencida' | 'futura'
export type FilaConEstado = FilaAmortizacion & { estado: EstadoCuota; hechoId?: string }

export function estadoCredito(c: Credito, hoy: string) {
  const tabla = tablaAmortizacion(c)
  const pagadas = new Map(c.pagos.filter((p) => p.numeroCuota > 0).map((p) => [p.numeroCuota, p]))
  const filas: FilaConEstado[] = tabla.map((f) => ({
    ...f,
    estado: pagadas.has(f.numero) ? 'pagada' : f.fecha < hoy ? 'vencida' : 'futura',
    hechoId: pagadas.get(f.numero)?.hechoId,
  }))
  const capitalPagado = c.pagos.reduce((s, p) => s + p.capital, 0)
  const saldoReal = c.monto - capitalPagado
  const ultimaVencida = [...tabla].reverse().find((f) => f.fecha <= hoy)
  const saldoTabla = ultimaVencida ? ultimaVencida.saldo : c.monto
  const vencidas = filas.filter((f) => f.estado === 'vencida')
  const proxima = filas.find((f) => f.estado !== 'pagada')
  const bancoUltimo = [...c.saldosBanco].sort((a, b) => a.fecha.localeCompare(b.fecha)).at(-1)
  return {
    filas, saldoReal, saldoTabla, vencidas, proxima,
    interesesPagados: c.pagos.reduce((s, p) => s + p.interes, 0),
    cargosPagados: c.pagos.reduce((s, p) => s + p.cargos, 0),
    tasaMensual: tasaMensual(c.tasa),
    cuotaFinanciera: tabla[0]?.cuotaFinanciera ?? 0,
    cuotaTotal: (tabla[0]?.cuotaFinanciera ?? 0) + c.cargosPorCuota,
    saldoBanco: bancoUltimo,
    diferenciaBanco: bancoUltimo ? bancoUltimo.saldo - saldoReal : undefined,
  }
}

/** Serie para la gráfica: saldo según la tabla vs saldo real (por pagos) en cada fecha de cuota. */
export function serieSaldos(c: Credito, hoy: string) {
  const tabla = tablaAmortizacion(c)
  return tabla.map((f) => ({
    fecha: f.fecha,
    tabla: f.saldo,
    real: f.fecha <= hoy ? c.monto - c.pagos.filter((p) => p.fecha <= f.fecha).reduce((s, p) => s + p.capital, 0) : null,
  }))
}
