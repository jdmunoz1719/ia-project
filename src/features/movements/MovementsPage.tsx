import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertTriangle, ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Lock, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DateInput, DateText, EmptyState, Field, LoadingRows, Money, PageHeader, Selector, Tag } from '@/components/common'
import { openTransaction } from '@/components/panels'
import { useServiceQuery } from '@/hooks/useServiceQuery'
import { api, TYPE_NAME, type Direction, type TransactionFilters } from '@/services/api'
import type { TransactionType } from '@/domain/types'
import { useUI } from '@/store/ui'
import { cn } from '@/lib/utils'

const PAGE = 100
const TYPES = Object.keys(TYPE_NAME).filter((t) => t !== 'task') as TransactionType[]
const DIRECTION_ICON: Record<Direction, { icon: typeof ArrowUpRight; label: string; className: string }> = {
  in: { icon: ArrowDownLeft, label: 'Entra', className: 'text-emerald-600' },
  out: { icon: ArrowUpRight, label: 'Sale', className: 'text-red-600' },
  internal: { icon: ArrowLeftRight, label: 'Entre cuentas', className: 'text-sky-600' },
}

export default function MovementsPage() {
  const [params] = useSearchParams()
  const { view } = useUI()
  const initialEntity = view !== 'group' ? view : ''
  const [filters, setFilters] = useState<TransactionFilters>(() => ({ entityId: initialEntity || undefined, withoutAttachment: params.get('sinSoporte') === '1' || undefined, from: params.get('desde') || undefined }))
  const [shown, setShown] = useState(PAGE)

  // El selector global "Ver" de la barra superior también filtra esta tabla.
  const [previousView, setPreviousView] = useState(view)
  if (view !== previousView) {
    setPreviousView(view)
    setFilters((f) => ({ ...f, entityId: view !== 'group' ? view : undefined, projectId: undefined, accountId: undefined }))
  }

  const { data: rows, loading, refreshing } = useServiceQuery(() => api.movements.list(filters), [JSON.stringify(filters)])
  const { data: cfg } = useServiceQuery(() => api.settings.get(), [])
  const set = (x: Partial<TransactionFilters>) => { setFilters((f) => ({ ...f, ...x })); setShown(PAGE) }
  const active = Object.values(filters).some((v) => v !== undefined && v !== '')
  const name = <T extends { id: string; name: string }>(arr: T[] | undefined, id?: string) => arr?.find((x) => x.id === id)?.name ?? '—'

  return (
    <div>
      <PageHeader title="Movimientos" description="Todo lo aprobado, registrado una sola vez. Haz clic en una fila para ver cómo afecta y su soporte original." />

      <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl border bg-card p-4 sm:grid-cols-3 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_130px_130px]">
        <Field label="Buscar" className="col-span-2 sm:col-span-3 lg:col-span-1">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-8 pl-8" placeholder="Descripción" value={filters.text ?? ''} onChange={(e) => set({ text: e.target.value || undefined })} />
          </div>
        </Field>
        <Field label="Empresa">
          <Selector value={filters.entityId ?? ''} onChange={(e) => set({ entityId: e.target.value || undefined, projectId: undefined, accountId: undefined })}
            options={(cfg?.entities ?? []).map((e) => ({ value: e.id, label: e.name }))} emptyLabel="Todas" />
        </Field>
        <Field label="Proyecto">
          <Selector value={filters.projectId ?? ''} onChange={(e) => set({ projectId: e.target.value || undefined })}
            options={(cfg?.projects ?? []).filter((p) => !filters.entityId || p.entityId === filters.entityId).map((p) => ({ value: p.id, label: p.name }))} emptyLabel="Todos" />
        </Field>
        <Field label="Cuenta">
          <Selector value={filters.accountId ?? ''} onChange={(e) => set({ accountId: e.target.value || undefined })}
            options={(cfg?.accounts ?? []).filter((a) => !filters.entityId || a.entityId === filters.entityId).map((a) => ({ value: a.id, label: a.name }))} emptyLabel="Todas" />
        </Field>
        <Field label="Tipo">
          <Selector value={filters.type ?? ''} onChange={(e) => set({ type: (e.target.value || undefined) as TransactionType | undefined })}
            options={TYPES.map((t) => ({ value: t, label: TYPE_NAME[t] }))} emptyLabel="Todos" />
        </Field>
        <Field label="Desde"><DateInput value={filters.from} onChange={(v) => set({ from: v })} /></Field>
        <Field label="Hasta"><DateInput value={filters.to} onChange={(v) => set({ to: v })} /></Field>
        <div className="col-span-2 flex flex-wrap items-center gap-3 sm:col-span-3 lg:col-span-7">
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-amber-600" checked={!!filters.withoutAttachment} onChange={(e) => set({ withoutAttachment: e.target.checked || undefined })} />
            <AlertTriangle className="size-4 text-amber-600" />Solo sin soporte
          </label>
          {active && <Button variant="ghost" size="sm" onClick={() => { setFilters({}); setShown(PAGE) }}><X />Limpiar filtros</Button>}
          <span className={cn('ml-auto text-sm text-muted-foreground', refreshing && 'opacity-60')}>
            {rows ? `${rows.length.toLocaleString('es-CO')} movimientos` : 'Cargando…'}
          </span>
        </div>
      </div>

      {loading ? <LoadingRows rows={10} /> : !rows?.length ? (
        <EmptyState title="No hay movimientos con estos filtros" text="Cambia o limpia los filtros para ver más." />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">Fecha</th>
                  <th className="px-4 py-2.5 text-left font-medium">Descripción</th>
                  <th className="px-4 py-2.5 text-left font-medium">Tipo</th>
                  <th className="px-4 py-2.5 text-left font-medium">Empresa</th>
                  <th className="px-4 py-2.5 text-left font-medium">Cuenta</th>
                  <th className="px-4 py-2.5 text-right font-medium">Monto</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, shown).map((h) => {
                  const d = DIRECTION_ICON[h.direction]
                  return (
                    <tr key={h.id} onClick={() => openTransaction(h.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && openTransaction(h.id)}
                      className="cursor-pointer border-t transition hover:bg-muted/40 focus-visible:bg-muted/60 focus-visible:outline-none">
                      <td className="px-4 py-2.5"><DateText iso={h.date} /></td>
                      <td className="max-w-[320px] px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          {h.attachmentIds.length === 0 && <span title="Sin soporte" className="shrink-0"><AlertTriangle className="size-4 text-amber-600" aria-label="Sin soporte" /></span>}
                          {h.locked && <span title="Mes cerrado" className="shrink-0"><Lock className="size-3.5 text-muted-foreground" aria-label="Mes cerrado" /></span>}
                          <span className="truncate">{h.description}</span>
                          {h.intercompany && <Tag tone="amber" className="shrink-0">Entre empresas</Tag>}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">{TYPE_NAME[h.type]}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {h.allocations.length > 1 ? <Tag tone="blue">Repartido · {h.allocations.length}</Tag> : name(cfg?.entities, h.allocations[0]?.entityId)}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">{cfg?.accounts.find((a) => a.id === (h.sourceAccountId ?? h.destinationAccountId))?.bank ?? '—'}</td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          <d.icon className={cn('size-3.5', d.className)} aria-label={d.label} />
                          <Money value={h.amount} className={h.direction === 'in' ? 'text-emerald-700' : h.direction === 'out' ? 'text-red-700' : ''} />
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {rows.length > shown && (
            <div className="border-t p-3 text-center">
              <Button variant="outline" size="sm" onClick={() => setShown((n) => n + PAGE)}>Mostrar {Math.min(PAGE, rows.length - shown)} más</Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
