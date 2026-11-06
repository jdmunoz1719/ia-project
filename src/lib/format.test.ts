import { describe, expect, it } from 'vitest'
import { formatCOP, formatFecha, formatPct } from './format'

describe('formatos colombianos', () => {
  it('dinero', () => {
    expect(formatCOP(1180000)).toBe('$ 1.180.000')
    expect(formatCOP(-2350000)).toBe('-$ 2.350.000')
    expect(formatCOP(0)).toBe('$ 0')
  })
  it('fecha', () => expect(formatFecha('2026-10-27')).toBe('27/10/2026'))
  it('porcentaje', () => expect(formatPct(0.011348, 4)).toBe('1,1348 %'))
})
