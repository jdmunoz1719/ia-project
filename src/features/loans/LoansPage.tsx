import { Link } from 'react-router-dom'
import { AlertTriangle, ChevronRight, Landmark } from 'lucide-react'
import { DateText, EmptyState, LoadingRows, Money, PageHeader, Tag } from '@/components/common'
import { useServiceQuery } from '@/hooks/useServiceQuery'
import { api } from '@/services/api'
import { formatPct } from '@/lib/format'

export default function LoansPage() {
  const { data: loans, loading } = useServiceQuery(() => api.loans.list(), [])
  const { data: cfg } = useServiceQuery(() => api.settings.get(), [])
  const entity = (id: string) => cfg?.entities.find((e) => e.id === id)?.name ?? '—'

  return (
    <div>
      <PageHeader title="Créditos" description="Saldo real según los pagos registrados, próxima cuota y alertas de cuotas vencidas." />
      {loading ? <LoadingRows rows={4} /> : !loans?.length ? (
        <EmptyState title="No hay créditos en esta vista" text="Cambia el selector «Ver» de la barra superior para ver otras empresas." icon={<Landmark />} />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {loans.map((c) => (
            <li key={c.loan.id}>
              <Link to={`/creditos/${c.loan.id}`} className="block rounded-xl border bg-card p-4 transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{c.loan.name}</p>
                    <p className="text-sm text-muted-foreground">{c.loan.bank} · {entity(c.loan.entityId)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {c.overdue > 0 && <Tag tone="red"><AlertTriangle />Cuotas vencidas · {c.overdue}</Tag>}
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </div>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div><dt className="text-xs text-muted-foreground">Saldo real</dt><dd className="font-semibold"><Money value={c.actualBalance} /></dd></div>
                  <div><dt className="text-xs text-muted-foreground">Cuotas pagadas</dt><dd className="num">{c.paidByNumber} de {c.loan.installmentCount}</dd></div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Próxima cuota</dt>
                    <dd>{c.next ? <><Money value={c.totalInstallment} /> · <DateText iso={c.next.date} /></> : 'Sin cuotas pendientes'}</dd>
                  </div>
                  <div><dt className="text-xs text-muted-foreground">Tasa mensual</dt><dd className="num">{formatPct(c.monthlyRate, 4)}</dd></div>
                </dl>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
