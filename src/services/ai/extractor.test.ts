import { describe, expect, it } from 'vitest'
import { extractProposals, extractWhatsAppChat, type AiConfig } from './extractor'
import * as seed from '@/data/seed'

const { loans } = seed.generateSeed()
const cfg: AiConfig = { ...seed, loans }

describe('Ejemplo 1: mensaje de WhatsApp del 28/10/2026', () => {
  const text = 'Ayer pagué 1.180.000 de la nómina del taller desde el Banco B de la Empresa A. Mañana hay que pagar la cuota del crédito constructor.'
  const ps = extractProposals(text, '2026-10-28T09:00:00', cfg)
  it('produce exactamente dos propuestas pendientes', () => {
    expect(ps).toHaveLength(2)
    expect(ps.every((p) => p.status === 'pending')).toBe(true)
  })
  it('1. gasto de nómina', () => {
    const p = ps[0]
    expect(p.type).toBe('expense')
    expect(p.fields.amount).toBe(1_180_000)
    expect(p.fields.date).toBe('2026-10-27')
    expect(p.fields.payerEntityId).toBe('emp-a')
    expect(p.fields.sourceAccountId).toBe('cta-bancob')
    expect(p.fields.categoryId).toBe('cat-nomina')
    expect(p.fields.allocations).toEqual([{ entityId: 'emp-a', projectId: 'pry-taller', amount: 1_180_000 }])
    expect(p.confidence).toBeGreaterThanOrEqual(85)
    expect(text.slice(p.evidence.find((e) => e.field === 'amount')!.start, p.evidence.find((e) => e.field === 'amount')!.end)).toBe('1.180.000')
  })
  it('2. tarea vinculada al crédito constructor', () => {
    const p = ps[1]
    expect(p.type).toBe('task')
    expect(p.fields.taskTitle).toBe('Pagar cuota del crédito constructor')
    expect(p.fields.due).toBe('2026-10-29')
    expect(p.fields.loanId).toBe('cred-constructor')
  })
})

describe('Ejemplo 2: B paga el arriendo de la bodega de A', () => {
  const [p, ...rest] = extractProposals('Pagué 2.350.000 de arriendo de la bodega desde Bancolombia de la Empresa B', '2026-10-28T10:00:00', cfg)
  it('pagadora B, gasto de A en el proyecto Bodega', () => {
    expect(rest).toHaveLength(0)
    expect(p.type).toBe('expense')
    expect(p.fields.amount).toBe(2_350_000)
    expect(p.fields.payerEntityId).toBe('emp-b')
    expect(p.fields.sourceAccountId).toBe('cta-bancolombia')
    expect(p.fields.allocations).toEqual([{ entityId: 'emp-a', projectId: 'pry-bodega', amount: 2_350_000 }])
    expect(p.fields.categoryId).toBe('cat-arriendo')
    expect(p.note).toBe('Fecha tomada de la recepción')
  })
})

describe('Montos y fechas', () => {
  const m = (t: string) => extractProposals(t, '2026-10-28', cfg)[0].fields
  it('formatos de monto', () => {
    expect(m('pagué 2,35 millones de arriendo').amount).toBe(2_350_000)
    expect(m('pagué 1.18 millones de nómina').amount).toBe(1_180_000)
    expect(m('gasté 350 mil en fletes').amount).toBe(350_000)
    expect(m('pagué $2.350.000 de arriendo').amount).toBe(2_350_000)
  })
  it('fechas relativas', () => {
    expect(m('antier pagué 350 mil').date).toBe('2026-10-26')
    expect(m('pagué 350 mil el 15/10').date).toBe('2026-10-15')
    expect(m('pagué 350 mil el 03/09/2026').date).toBe('2026-09-03')
    expect(extractProposals('toca pagar la administración el 5', '2026-10-28', cfg)[0].fields.due).toBe('2026-11-05')
    expect(extractProposals('pasado mañana hay que pagar el IVA', '2026-10-28', cfg)[0].fields.due).toBe('2026-10-30')
  })
  it('sin datos: baja confianza y campos vacíos', () => {
    const p = extractProposals('Ya le pagué lo del contador', '2026-10-26', cfg)[0]
    expect(p.confidence).toBeLessThan(60)
    expect(p.fields.amount).toBeUndefined()
  })
})

describe('Chat exportado', () => {
  it('cada mensaje con su fecha, evidencia sobre el texto completo', () => {
    const txt = '20/10/26, 7:52 a. m. - Andrés Gómez: Ayer recibí 4.200.000 de Comercializadora Nova en Banco B de la Empresa A\n20/10/26, 9:14 a. m. - Laura Restrepo: Perfecto'
    const ps = extractWhatsAppChat(txt, cfg)
    expect(ps).toHaveLength(1)
    expect(ps[0].type).toBe('income')
    expect(ps[0].fields.date).toBe('2026-10-19')
    expect(ps[0].fields.destinationAccountId).toBe('cta-bancob')
    const e = ps[0].evidence.find((x) => x.field === 'amount')!
    expect(txt.slice(e.start, e.end)).toBe('4.200.000')
  })
})
