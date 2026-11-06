// Formatos colombianos, centralizados.
const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0, minimumFractionDigits: 0 })

/** $ 1.180.000 (espacio normal, signo menos delante del símbolo). */
export const formatCOP = (n: number) => cop.format(Math.round(n)).replace(/ /g, ' ')

/** yyyy-mm-dd → dd/mm/aaaa */
export const formatDate = (iso?: string) => {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

export const formatDateTime = (iso: string) => {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** Fracción → "1,1348 %" */
export const formatPct = (fraction: number, decimals = 2) => `${(fraction * 100).toFixed(decimals).replace('.', ',')} %`

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
/** "2026-10" → "octubre 2026" */
export const formatMonth = (ym: string, short = false) => {
  const [y, m] = ym.split('-').map(Number)
  const n = MONTHS[m - 1]
  return short ? `${n.slice(0, 3)} ${String(y).slice(2)}` : `${n} ${y}`
}

export const formatSize = (bytes: number) => bytes > 1e6 ? `${(bytes / 1e6).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(bytes / 1e3))} KB`
