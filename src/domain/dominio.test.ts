import { describe, expect, it } from 'vitest'
import { tablaAmortizacion, tasaMensual, estadoCredito } from './amortizacion'
import { expandirTodos, deudaEntre, saldoCuenta } from './libro'
import { calcularIndicadores, type Contexto } from './indicadores'
import type { Credito, Cuenta, Entidad, Hecho } from './tipos'

const entidades: Entidad[] = [
  { id: 'A', nombre: 'Empresa A', alias: [], esPersonal: false },
  { id: 'B', nombre: 'Empresa B', alias: [], esPersonal: false },
  { id: 'C', nombre: 'Empresa C', alias: [], esPersonal: false },
]
const cuentas: Cuenta[] = [
  { id: 'banco-b', entidadId: 'A', banco: 'Banco B', nombre: 'Banco B', alias: [], saldoInicial: 10_000_000, fechaSaldoInicial: '2026-10-01' },
  { id: 'bancolombia', entidadId: 'B', banco: 'Bancolombia', nombre: 'Bancolombia', alias: [], saldoInicial: 10_000_000, fechaSaldoInicial: '2026-10-01' },
]
const ctx: Contexto = { entidades, cuentas, proyectos: [], pendientes: [] }
const grupo = { tipo: 'grupo', incluirPersonales: true } as const
const hecho = (h: Partial<Hecho> & Pick<Hecho, 'id' | 'tipo' | 'monto' | 'entidadPagadoraId' | 'asignaciones'>): Hecho =>
  ({ fecha: '2026-10-15', descripcion: '', soporteIds: [], aprobadoPor: 'test', aprobadoEn: '', ...h })

describe('Ejemplo 2: la Empresa B paga el arriendo de la Empresa A', () => {
  const arriendo = hecho({ id: 'h1', tipo: 'gasto', monto: 2_350_000, cuentaOrigenId: 'bancolombia', entidadPagadoraId: 'B', asignaciones: [{ entidadId: 'A', monto: 2_350_000 }] })
  const lineas = expandirTodos([arriendo], cuentas)

  it('A tiene un gasto de $2.350.000', () => {
    expect(calcularIndicadores(lineas, { tipo: 'entidad', entidadId: 'A' }, ctx).resultadoOperativo.valor).toBe(-2_350_000)
  })
  it('B no tiene gasto, pero su cuenta baja $2.350.000', () => {
    expect(calcularIndicadores(lineas, { tipo: 'entidad', entidadId: 'B' }, ctx).resultadoFinal.valor).toBe(0)
    expect(saldoCuenta(cuentas[1], lineas)).toBe(10_000_000 - 2_350_000)
  })
  it('A le debe $2.350.000 a B', () => {
    expect(deudaEntre(lineas, 'A', 'B').valor).toBe(2_350_000)
    expect(deudaEntre(lineas, 'B', 'A').valor).toBe(-2_350_000)
  })
  it('en el grupo el gasto aparece una vez y no hay deuda interna', () => {
    const g = calcularIndicadores(lineas, grupo, ctx)
    expect(g.resultadoFinal.valor).toBe(-2_350_000)
    expect(g.resultadoFinal.lineas).toHaveLength(1)
    expect([...g.saldoCaja.lineas, ...g.resultadoFinal.lineas].some((l) => l.concepto.endsWith('_ic'))).toBe(false)
  })
  it('cuando A le devuelve a B, la deuda queda en $0 y el grupo no ve entradas ni salidas', () => {
    const devolucion = hecho({ id: 'h2', tipo: 'pago_intercompania', monto: 2_350_000, cuentaOrigenId: 'banco-b', cuentaDestinoId: 'bancolombia', entidadPagadoraId: 'A', asignaciones: [{ entidadId: 'B', monto: 2_350_000 }] })
    const ls = expandirTodos([arriendo, devolucion], cuentas)
    expect(deudaEntre(ls, 'A', 'B').valor).toBe(0)
    const g = calcularIndicadores(ls, grupo, ctx)
    expect(g.resultadoFinal.valor).toBe(-2_350_000)
    expect(g.salidas).toBe(2_350_000) // sólo el arriendo; la devolución es interna
    expect(calcularIndicadores(ls, { tipo: 'entidad', entidadId: 'B' }, ctx).resultadoFinal.valor).toBe(0)
  })
})

describe('Gasto repartido: arriendo de $3.000.000 pagado por A, 50 % A y 50 % C', () => {
  const h = hecho({ id: 'r1', tipo: 'gasto', monto: 3_000_000, cuentaOrigenId: 'banco-b', entidadPagadoraId: 'A',
    asignaciones: [{ entidadId: 'A', monto: 1_500_000 }, { entidadId: 'C', monto: 1_500_000 }] })
  const ls = expandirTodos([h], cuentas)
  it('C le debe $1.500.000 a A', () => expect(deudaEntre(ls, 'C', 'A').valor).toBe(1_500_000))
  it('cada una registra su parte', () => {
    expect(calcularIndicadores(ls, { tipo: 'entidad', entidadId: 'A' }, ctx).resultadoFinal.valor).toBe(-1_500_000)
    expect(calcularIndicadores(ls, { tipo: 'entidad', entidadId: 'C' }, ctx).resultadoFinal.valor).toBe(-1_500_000)
  })
  it('el grupo muestra un solo gasto de $3.000.000', () => {
    const g = calcularIndicadores(ls, grupo, ctx)
    expect(g.resultadoFinal.valor).toBe(-3_000_000)
    expect(g.salidas).toBe(3_000_000)
  })
})

describe('Otros tipos de hecho', () => {
  it('inversión en proyecto no es gasto', () => {
    const ls = expandirTodos([hecho({ id: 'i', tipo: 'inversion_proyecto', monto: 5_000_000, cuentaOrigenId: 'banco-b', entidadPagadoraId: 'A', asignaciones: [{ entidadId: 'A', monto: 5_000_000 }] })], cuentas)
    const r = calcularIndicadores(ls, { tipo: 'entidad', entidadId: 'A' }, ctx)
    expect(r.resultadoFinal.valor).toBe(0)
    expect(r.inversionProyectos.valor).toBe(5_000_000)
    expect(r.flujoCaja.valor).toBe(-5_000_000)
  })
  it('pago de crédito: capital baja deuda, interés y cargos son financieros', () => {
    const ls = expandirTodos([hecho({ id: 'p', tipo: 'pago_credito', monto: 2_914_933, cuentaOrigenId: 'banco-b', entidadPagadoraId: 'A', asignaciones: [{ entidadId: 'A', monto: 2_914_933 }], desglosePagoCredito: { capital: 2_189_076, interes: 680_857, cargos: 45_000 } })], cuentas)
    const r = calcularIndicadores(ls, { tipo: 'entidad', entidadId: 'A' }, ctx)
    expect(r.resultadoOperativo.valor).toBe(0)
    expect(r.resultadoFinal.valor).toBe(-725_857)
    expect(ls.find((l) => l.concepto === 'credito')?.monto).toBe(-2_189_076)
  })
  it('las propuestas pendientes no cambian cifras, sólo el aviso', () => {
    const r = calcularIndicadores([], grupo, { ...ctx, pendientes: [{ id: 'x', tipo: 'gasto', campos: { fecha: '2026-10-10', entidadPagadoraId: 'A', monto: 1 }, confianza: 90, evidencia: [], estado: 'pendiente' }] })
    expect(r.resultadoFinal.valor).toBe(0)
    expect(r.resultadoFinal.pendientesPorAprobar).toBe(1)
  })
})

describe('Ejemplo 3: crédito de $60.000.000 al 14,5 % EA, 24 cuotas', () => {
  const cred: Credito = {
    id: 'c', nombre: 'Crédito constructor', banco: 'Davivienda', entidadId: 'C', monto: 60_000_000,
    tasa: { valor: 0.145, tipo: 'EA' }, numCuotas: 24, primeraFecha: '2026-09-05', cargosPorCuota: 45_000,
    pagos: [{ hechoId: 'h', numeroCuota: 1, capital: 2_189_076, interes: 680_857, cargos: 45_000, fecha: '2026-09-05' }],
    saldosBanco: [], cambios: [],
  }
  const t = tablaAmortizacion(cred)
  it('tasa mensual 1,1348 %', () => expect((tasaMensual(cred.tasa) * 100).toFixed(4)).toBe('1.1348'))
  it('cuota financiera y total', () => {
    expect(t[0].cuotaFinanciera).toBe(2_869_933)
    expect(t[0].total).toBe(2_914_933)
  })
  it('cuota 1', () => {
    expect(t[0].capital).toBe(2_189_076)
    expect(t[0].interes).toBe(680_857)
    expect(t[0].cargos).toBe(45_000)
    expect(t[0].saldo).toBe(57_810_924)
  })
  it('cuota 2', () => {
    expect(t[1].interes).toBe(656_016)
    expect(t[1].capital).toBe(2_213_917)
  })
  it('cuota 24 cierra en $0', () => {
    expect(t[23].saldo).toBe(0)
    expect(t[23].capital).toBe(2_837_730)
    expect(t[23].interes).toBe(32_201)
  })
  it('al 28/10/2026: cuota 1 pagada, cuota 2 vencida', () => {
    const e = estadoCredito(cred, '2026-10-28')
    expect(e.filas[0].estado).toBe('pagada')
    expect(e.filas[1].estado).toBe('vencida')
    expect(e.filas[2].estado).toBe('futura')
    expect(e.saldoReal).toBe(57_810_924)
  })
})
