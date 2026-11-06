import { useEffect, useRef, useState, type ReactNode, type SelectHTMLAttributes } from 'react'
import { CalendarDays, Inbox, Info } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCOP, formatFecha } from '@/lib/format'
import { cn } from '@/lib/utils'

export function Money({ valor, signo = false, color = false, className }: { valor: number; signo?: boolean; color?: boolean; className?: string }) {
  const txt = formatCOP(valor)
  return (
    <span className={cn('num whitespace-nowrap', color && (valor > 0 ? 'text-emerald-700' : valor < 0 ? 'text-red-700' : ''), className)}>
      {signo && valor > 0 ? '+' : ''}{txt}
    </span>
  )
}

export const Fecha = ({ iso, className }: { iso?: string; className?: string }) => <span className={cn('num whitespace-nowrap', className)}>{formatFecha(iso)}</span>

export function colorConfianza(c: number) {
  return c >= 85 ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' : c >= 60 ? 'bg-amber-50 text-amber-800 ring-amber-600/25' : 'bg-red-50 text-red-700 ring-red-600/20'
}
export const Confianza = ({ valor }: { valor: number }) => (
  <span className={cn('num inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset', colorConfianza(valor))} title="Qué tan segura está la IA">
    {valor} %
  </span>
)

type Tono = 'verde' | 'rojo' | 'ambar' | 'azul' | 'gris'
const TONOS: Record<Tono, string> = {
  verde: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', rojo: 'bg-red-50 text-red-700 ring-red-600/20',
  ambar: 'bg-amber-50 text-amber-800 ring-amber-600/25', azul: 'bg-sky-50 text-sky-800 ring-sky-600/20', gris: 'bg-muted text-muted-foreground ring-border',
}
export const Etiqueta = ({ tono = 'gris', children, className }: { tono?: Tono; children: ReactNode; className?: string }) => (
  <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset [&_svg]:size-3', TONOS[tono], className)}>{children}</span>
)

export function Encabezado({ titulo, descripcion, acciones }: { titulo: string; descripcion?: ReactNode; acciones?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{titulo}</h1>
        {descripcion && <p className="mt-1 text-sm text-muted-foreground">{descripcion}</p>}
      </div>
      {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
    </div>
  )
}

export const Vacio = ({ titulo, texto, icono }: { titulo: string; texto?: string; icono?: ReactNode }) => (
  <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-12 text-center">
    <div className="text-muted-foreground [&_svg]:size-8">{icono ?? <Inbox />}</div>
    <p className="font-medium">{titulo}</p>
    {texto && <p className="max-w-sm text-sm text-muted-foreground">{texto}</p>}
  </div>
)

export const Cargando = ({ filas = 4, className }: { filas?: number; className?: string }) => (
  <div className={cn('space-y-2', className)}>{Array.from({ length: filas }, (_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
)

export const BaseCaja = () => (
  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground" title="Sólo cuenta lo que entra o sale efectivamente de caja"><Info className="size-3" />base caja</span>
)

/** Select nativo con estilo (funciona bien en celular y sólo ofrece valores de la configuración). */
export function Selector({ className, opciones, vacio, ...p }: SelectHTMLAttributes<HTMLSelectElement> & { opciones: { value: string; label: string; grupo?: string }[]; vacio?: string }) {
  const grupos = [...new Set(opciones.map((o) => o.grupo))]
  const render = (os: typeof opciones) => os.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)
  return (
    <select {...p} className={cn('h-8 w-full min-w-0 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60', className)}>
      {vacio !== undefined && <option value="">{vacio}</option>}
      {grupos.length > 1 || grupos[0] ? grupos.map((g) => <optgroup key={g ?? ''} label={g ?? ''}>{render(opciones.filter((o) => o.grupo === g))}</optgroup>) : render(opciones)}
    </select>
  )
}

export const Campo = ({ etiqueta, children, className, error }: { etiqueta: string; children: ReactNode; className?: string; error?: string }) => (
  <label className={cn('flex min-w-0 flex-col gap-1', className)}>
    <span className="text-xs font-medium text-muted-foreground">{etiqueta}</span>
    {children}
    {error && <span className="text-xs text-red-600">{error}</span>}
  </label>
)

/** Input de dinero en pesos enteros: muestra 1.234.567 mientras se escribe. */
export function InputDinero({ valor, onChange, className, ...p }: { valor?: number; onChange: (v: number | undefined) => void; className?: string; disabled?: boolean; autoFocus?: boolean }) {
  return (
    <div className={cn('relative', className)}>
      <span className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
      <input
        {...p} inputMode="numeric"
        className="num h-8 w-full rounded-lg border border-input bg-background pr-2 pl-5 text-right text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
        value={valor === undefined ? '' : valor.toLocaleString('es-CO')}
        onChange={(e) => { const d = e.target.value.replace(/\D/g, ''); onChange(d ? Number(d) : undefined) }}
      />
    </div>
  )
}

/** Fecha en formato dd/mm/aaaa (independiente del idioma del navegador) con selector nativo. */
export function InputFecha({ valor, onChange, disabled }: { valor?: string; onChange: (v: string) => void; disabled?: boolean }) {
  const [txt, setTxt] = useState(valor ? formatFecha(valor) : "")
  useEffect(() => setTxt(valor ? formatFecha(valor) : ""), [valor])
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className="relative">
      <input
        disabled={disabled} value={txt} placeholder="dd/mm/aaaa" inputMode="numeric"
        className="num h-8 w-full rounded-lg border border-input bg-background pr-8 pl-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
        onChange={(e) => {
          const d = e.target.value.replace(/D/g, "").slice(0, 8)
          setTxt(d.slice(0, 2) + (d.length > 2 ? "/" + d.slice(2, 4) : "") + (d.length > 4 ? "/" + d.slice(4) : ""))
          if (d.length === 8) onChange(`${d.slice(4)}-${d.slice(2, 4)}-${d.slice(0, 2)}`)
        }}
      />
      <button type="button" disabled={disabled} aria-label="Abrir calendario" onClick={() => ref.current?.showPicker?.()} className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"><CalendarDays className="size-4" /></button>
      <input ref={ref} type="date" tabIndex={-1} aria-hidden className="pointer-events-none absolute right-0 bottom-0 h-px w-px opacity-0" value={valor ?? ""} onChange={(e) => e.target.value && onChange(e.target.value)} />
    </div>
  )
}
