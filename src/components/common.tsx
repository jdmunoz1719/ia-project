import { useRef, useState, type ReactNode, type SelectHTMLAttributes } from 'react'
import { CalendarDays, Inbox, Info } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCOP, formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'

export function Money({ value, sign = false, color = false, className }: { value: number; sign?: boolean; color?: boolean; className?: string }) {
  const txt = formatCOP(value)
  return (
    <span className={cn('num whitespace-nowrap', color && (value > 0 ? 'text-emerald-700' : value < 0 ? 'text-red-700' : ''), className)}>
      {sign && value > 0 ? '+' : ''}{txt}
    </span>
  )
}

export const DateText = ({ iso, className }: { iso?: string; className?: string }) => <span className={cn('num whitespace-nowrap', className)}>{formatDate(iso)}</span>

export function confidenceColor(c: number) {
  return c >= 85 ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' : c >= 60 ? 'bg-amber-50 text-amber-800 ring-amber-600/25' : 'bg-red-50 text-red-700 ring-red-600/20'
}
export const Confidence = ({ value }: { value: number }) => (
  <span className={cn('num inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset', confidenceColor(value))} title="Qué tan segura está la IA">
    {value} %
  </span>
)

type Tone = 'green' | 'red' | 'amber' | 'blue' | 'gray'
const TONES: Record<Tone, string> = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', red: 'bg-red-50 text-red-700 ring-red-600/20',
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/25', blue: 'bg-sky-50 text-sky-800 ring-sky-600/20', gray: 'bg-muted text-muted-foreground ring-border',
}
export const Tag = ({ tone = 'gray', children, className }: { tone?: Tone; children: ReactNode; className?: string }) => (
  <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset [&_svg]:size-3', TONES[tone], className)}>{children}</span>
)

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export const EmptyState = ({ title, text, icon }: { title: string; text?: string; icon?: ReactNode }) => (
  <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-12 text-center">
    <div className="text-muted-foreground [&_svg]:size-8">{icon ?? <Inbox />}</div>
    <p className="font-medium">{title}</p>
    {text && <p className="max-w-sm text-sm text-muted-foreground">{text}</p>}
  </div>
)

export const LoadingRows = ({ rows = 4, className }: { rows?: number; className?: string }) => (
  <div className={cn('space-y-2', className)}>{Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
)

export const CashBasisNote = () => (
  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground" title="Sólo cuenta lo que entra o sale efectivamente de caja"><Info className="size-3" />base caja</span>
)

/** Select nativo con estilo (funciona bien en celular y sólo ofrece valores de la configuración). */
export function Selector({ className, options, emptyLabel, ...p }: SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string; group?: string }[]; emptyLabel?: string }) {
  const groups = [...new Set(options.map((o) => o.group))]
  const render = (os: typeof options) => os.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)
  return (
    <select {...p} className={cn('h-8 w-full min-w-0 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60', className)}>
      {emptyLabel !== undefined && <option value="">{emptyLabel}</option>}
      {groups.length > 1 || groups[0] ? groups.map((g) => <optgroup key={g ?? ''} label={g ?? ''}>{render(options.filter((o) => o.group === g))}</optgroup>) : render(options)}
    </select>
  )
}

export const Field = ({ label, children, className, error }: { label: string; children: ReactNode; className?: string; error?: string }) => (
  <label className={cn('flex min-w-0 flex-col gap-1', className)}>
    <span className="text-xs font-medium text-muted-foreground">{label}</span>
    {children}
    {error && <span className="text-xs text-red-600">{error}</span>}
  </label>
)

/** Input de dinero en pesos enteros: muestra 1.234.567 mientras se escribe. */
export function MoneyInput({ value, onChange, className, ...p }: { value?: number; onChange: (v: number | undefined) => void; className?: string; disabled?: boolean; autoFocus?: boolean }) {
  return (
    <div className={cn('relative', className)}>
      <span className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
      <input
        {...p} inputMode="numeric"
        className="num h-8 w-full rounded-lg border border-input bg-background pr-2 pl-5 text-right text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
        value={value === undefined ? '' : value.toLocaleString('es-CO')}
        onChange={(e) => { const d = e.target.value.replace(/\D/g, ''); onChange(d ? Number(d) : undefined) }}
      />
    </div>
  )
}

/** Fecha en formato dd/mm/aaaa (independiente del idioma del navegador) con selector nativo. */
export function DateInput({ value, onChange, disabled }: { value?: string; onChange: (v: string) => void; disabled?: boolean }) {
  const [txt, setTxt] = useState(value ? formatDate(value) : "")
  // Si la fecha cambia desde afuera (otra propuesta, selector nativo), se refleja en el texto.
  const [previous, setPrevious] = useState(value)
  if (value !== previous) { setPrevious(value); setTxt(value ? formatDate(value) : "") }
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className="relative">
      <input
        disabled={disabled} value={txt} placeholder="dd/mm/aaaa" inputMode="numeric"
        className="num h-8 w-full rounded-lg border border-input bg-background pr-8 pl-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
        onChange={(e) => {
          const d = e.target.value.replace(/\D/g, "").slice(0, 8)
          setTxt(d.slice(0, 2) + (d.length > 2 ? "/" + d.slice(2, 4) : "") + (d.length > 4 ? "/" + d.slice(4) : ""))
          if (d.length === 8) onChange(`${d.slice(4)}-${d.slice(2, 4)}-${d.slice(0, 2)}`)
        }}
      />
      <button type="button" disabled={disabled} aria-label="Abrir calendario" onClick={() => ref.current?.showPicker?.()} className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"><CalendarDays className="size-4" /></button>
      <input ref={ref} type="date" tabIndex={-1} aria-hidden className="pointer-events-none absolute right-0 bottom-0 h-px w-px opacity-0" value={value ?? ""} onChange={(e) => e.target.value && onChange(e.target.value)} />
    </div>
  )
}
