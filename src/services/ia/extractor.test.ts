import { describe, expect, it } from 'vitest'
import { extraerPropuestas, extraerChatWhatsApp, type ConfigIA } from './extractor'
import * as seed from '@/data/seed'

const { creditos } = seed.generarSemilla()
const cfg: ConfigIA = { ...seed, creditos }

describe('Ejemplo 1: mensaje de WhatsApp del 28/10/2026', () => {
  const texto = 'Ayer pagué 1.180.000 de la nómina del taller desde el Banco B de la Empresa A. Mañana hay que pagar la cuota del crédito constructor.'
  const ps = extraerPropuestas(texto, '2026-10-28T09:00:00', cfg)
  it('produce exactamente dos propuestas pendientes', () => {
    expect(ps).toHaveLength(2)
    expect(ps.every((p) => p.estado === 'pendiente')).toBe(true)
  })
  it('1. gasto de nómina', () => {
    const p = ps[0]
    expect(p.tipo).toBe('gasto')
    expect(p.campos.monto).toBe(1_180_000)
    expect(p.campos.fecha).toBe('2026-10-27')
    expect(p.campos.entidadPagadoraId).toBe('emp-a')
    expect(p.campos.cuentaOrigenId).toBe('cta-bancob')
    expect(p.campos.categoriaId).toBe('cat-nomina')
    expect(p.campos.asignaciones).toEqual([{ entidadId: 'emp-a', proyectoId: 'pry-taller', monto: 1_180_000 }])
    expect(p.confianza).toBeGreaterThanOrEqual(85)
    expect(texto.slice(p.evidencia.find((e) => e.campo === 'monto')!.inicio, p.evidencia.find((e) => e.campo === 'monto')!.fin)).toBe('1.180.000')
  })
  it('2. tarea vinculada al crédito constructor', () => {
    const p = ps[1]
    expect(p.tipo).toBe('tarea')
    expect(p.campos.tituloTarea).toBe('Pagar cuota del crédito constructor')
    expect(p.campos.vence).toBe('2026-10-29')
    expect(p.campos.creditoId).toBe('cred-constructor')
  })
})

describe('Ejemplo 2: B paga el arriendo de la bodega de A', () => {
  const [p, ...resto] = extraerPropuestas('Pagué 2.350.000 de arriendo de la bodega desde Bancolombia de la Empresa B', '2026-10-28T10:00:00', cfg)
  it('pagadora B, gasto de A en el proyecto Bodega', () => {
    expect(resto).toHaveLength(0)
    expect(p.tipo).toBe('gasto')
    expect(p.campos.monto).toBe(2_350_000)
    expect(p.campos.entidadPagadoraId).toBe('emp-b')
    expect(p.campos.cuentaOrigenId).toBe('cta-bancolombia')
    expect(p.campos.asignaciones).toEqual([{ entidadId: 'emp-a', proyectoId: 'pry-bodega', monto: 2_350_000 }])
    expect(p.campos.categoriaId).toBe('cat-arriendo')
  })
})

describe('Montos y fechas', () => {
  const m = (t: string) => extraerPropuestas(t, '2026-10-28', cfg)[0].campos
  it('formatos de monto', () => {
    expect(m('pagué 2,35 millones de arriendo').monto).toBe(2_350_000)
    expect(m('pagué 1.18 millones de nómina').monto).toBe(1_180_000)
    expect(m('gasté 350 mil en fletes').monto).toBe(350_000)
    expect(m('pagué $2.350.000 de arriendo').monto).toBe(2_350_000)
  })
  it('fechas relativas', () => {
    expect(m('antier pagué 350 mil').fecha).toBe('2026-10-26')
    expect(m('pagué 350 mil el 15/10').fecha).toBe('2026-10-15')
    expect(m('pagué 350 mil el 03/09/2026').fecha).toBe('2026-09-03')
    expect(extraerPropuestas('toca pagar la administración el 5', '2026-10-28', cfg)[0].campos.vence).toBe('2026-11-05')
    expect(extraerPropuestas('pasado mañana hay que pagar el IVA', '2026-10-28', cfg)[0].campos.vence).toBe('2026-10-30')
  })
  it('sin datos: baja confianza y campos vacíos', () => {
    const p = extraerPropuestas('Ya le pagué lo del contador', '2026-10-26', cfg)[0]
    expect(p.confianza).toBeLessThan(60)
    expect(p.campos.monto).toBeUndefined()
  })
})

describe('Chat exportado', () => {
  it('cada mensaje con su fecha, evidencia sobre el texto completo', () => {
    const txt = '20/10/26, 7:52 a. m. - Andrés Gómez: Ayer recibí 4.200.000 de Comercializadora Nova en Banco B de la Empresa A\n20/10/26, 9:14 a. m. - Laura Restrepo: Perfecto'
    const ps = extraerChatWhatsApp(txt, cfg)
    expect(ps).toHaveLength(1)
    expect(ps[0].tipo).toBe('ingreso')
    expect(ps[0].campos.fecha).toBe('2026-10-19')
    expect(ps[0].campos.cuentaDestinoId).toBe('cta-bancob')
    const e = ps[0].evidencia.find((x) => x.campo === 'monto')!
    expect(txt.slice(e.inicio, e.fin)).toBe('4.200.000')
  })
})
