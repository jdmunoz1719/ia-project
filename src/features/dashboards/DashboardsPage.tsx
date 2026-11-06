import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Copy, Inbox, Landmark } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CashBasisNote, DateInput, Field, LoadingRows, Money, PageHeader, Selector, Tag } from '@/components/common'
import { Figure, openDetail } from '@/components/panels'
import { useServiceQuery } from '@/hooks/useServiceQuery'
import { useSession } from '@/hooks/useSession'
import { api } from '@/services/api'
import { KPI_NAME, type KpiKey } from '@/domain/kpis'
import type { Scope } from '@/domain/ledger'
import { formatCOP, formatMonth } from '@/lib/format'
import { useUI } from '@/store/ui'

const KPI_KEYS = Object.keys(KPI_NAME) as KpiKey[]

export default function DashboardsPage() {
  const { today } = useSession()
  const { view, includePersonal, setIncludePersonal } = useUI()
  // La vista local arranca con el "Ver" global y lo sigue cuando cambia; aquí además se puede elegir un proyecto ("p:<id>").
  const [selected, setSelected] = useState(view)
  const [previousView, setPreviousView] = useState(view)
  if (view !== previousView) { setPreviousView(view); setSelected(view) }
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`)
  const [to, setTo] = useState(today)

  const { data: cfg } = useServiceQuery(() => api.settings.get(), [])
  const scope: Scope = selected.startsWith('p:') ? { type: 'project', projectId: selected.slice(2) }
    : selected === 'group' ? { type: 'group', includePersonal } : { type: 'entity', entityId: selected }
  const key = JSON.stringify([scope, from, to])

  const { data: kpis, loading } = useServiceQuery(() => api.dashboards.kpis(scope, from, to), [key])
  const { data: series } = useServiceQuery(() => api.dashboards.series(scope), [JSON.stringify(scope)])
  const { data: byEntity } = useServiceQuery(() => api.dashboards.byEntity(from, to), [from, to])
  const { data: quality } = useServiceQuery(() => api.dashboards.dataQuality(), [])

  const isGroup = scope.type === 'group'
  const viewOptions = [
    { value: 'group', label: 'Grupo', group: 'Vista' },
    ...(cfg?.entities ?? []).map((e) => ({ value: e.id, label: e.name, group: 'Empresas' })),
    ...(cfg?.projects ?? []).map((p) => ({ value: `p:${p.id}`, label: p.name, group: 'Proyectos' })),
  ]
  const chartData = (series ?? []).map((m) => ({ mes: formatMonth(m.month), Ingresos: m.revenue, Egresos: m.outflows }))
  const pendingApproval = kpis?.revenue.pendingApproval ?? 0

  return (
    <div className="space-y-6">
      <PageHeader title="Tableros" description={<span className="inline-flex flex-wrap items-center gap-2">Haz clic en una cifra para ver los movimientos que la forman. <CashBasisNote /></span>} />

      <div className="grid grid-cols-2 gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[1.5fr_1fr_1fr_auto]">
        <Field label="Vista" className="col-span-2 sm:col-span-1">
          <Selector aria-label="Vista" value={selected} onChange={(e) => setSelected(e.target.value)} options={viewOptions} />
        </Field>
        <Field label="Desde"><DateInput value={from} onChange={setFrom} /></Field>
        <Field label="Hasta"><DateInput value={to} onChange={setTo} /></Field>
        {isGroup && (
          <label className="col-span-2 inline-flex cursor-pointer items-center gap-2 self-end pb-1.5 text-sm sm:col-span-1">
            <input type="checkbox" className="size-4 accent-primary" checked={includePersonal} onChange={(e) => setIncludePersonal(e.target.checked)} />
            Incluir asuntos personales
          </label>
        )}
      </div>

      {loading || !kpis ? <LoadingRows rows={4} /> : (
        <section aria-label="Indicadores" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {KPI_KEYS.map((k) => (
            <div key={k} className="rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">{KPI_NAME[k]}</p>
                <CashBasisNote />
              </div>
              <Figure value={kpis[k].value} lines={kpis[k].lines} title={KPI_NAME[k]} color className="mt-1 text-xl font-semibold" />
              {kpis[k].pendingApproval > 0 && <Tag tone="amber" className="mt-2"><Inbox />{kpis[k].pendingApproval} por aprobar</Tag>}
            </div>
          ))}
        </section>
      )}
      {pendingApproval > 0 && <p className="-mt-3 text-xs text-muted-foreground">Lo que está por aprobar no cuenta en las cifras hasta que lo apruebes en la Bandeja.</p>}

      <section className="rounded-xl border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">Ingresos frente a egresos · últimos 6 meses</h2>
        <div className="h-64" role="img" aria-label="Gráfica de barras de ingresos y egresos por mes">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} width={92} tickFormatter={(v: number) => formatCOP(v)} />
              <Tooltip formatter={(v) => formatCOP(Number(v))} />
              <Legend />
              <Bar dataKey="Ingresos" fill="#059669" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Egresos" fill="#dc2626" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {isGroup && (
        <section className="overflow-hidden rounded-xl border bg-card">
          <h2 className="px-4 pt-4 text-sm font-semibold">Suma por empresa</h2>
          <div className="overflow-x-auto">
            <table className="mt-2 w-full min-w-[560px] text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">Empresa</th>
                  <th className="px-4 py-2.5 text-right font-medium">Ingresos</th>
                  <th className="px-4 py-2.5 text-right font-medium">Resultado final</th>
                  <th className="px-4 py-2.5 text-right font-medium">Flujo de caja</th>
                  <th className="px-4 py-2.5 text-right font-medium">Saldo de caja</th>
                </tr>
              </thead>
              <tbody>
                {(byEntity ?? []).filter((r) => includePersonal || !r.entity.isPersonal).map((r) => (
                  <tr key={r.entity.id} className="border-t">
                    <td className="px-4 py-2.5">{r.entity.name}</td>
                    <td className="px-4 py-2.5 text-right"><Money value={r.revenue} /></td>
                    <td className="px-4 py-2.5 text-right"><Money value={r.netResult} color /></td>
                    <td className="px-4 py-2.5 text-right"><Money value={r.cashFlow} color /></td>
                    <td className="px-4 py-2.5 text-right"><Money value={r.cashBalance} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-4 py-2 text-xs text-muted-foreground">Cada empresa se ve por separado; el total del grupo (arriba) no suma dos veces los pagos entre empresas.</p>
        </section>
      )}

      <section className="rounded-xl border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">Calidad del dato</h2>
        {!quality ? <LoadingRows rows={2} /> : (
          <ul className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <li className="flex items-start gap-2">
              {quality.pending ? <Inbox className="mt-0.5 size-4 text-amber-600" /> : <CheckCircle2 className="mt-0.5 size-4 text-emerald-600" />}
              <span><b className="num">{quality.pending}</b> propuestas por aprobar</span>
            </li>
            <li className="flex items-start gap-2">
              {quality.withoutAttachment.length ? <AlertTriangle className="mt-0.5 size-4 text-amber-600" /> : <CheckCircle2 className="mt-0.5 size-4 text-emerald-600" />}
              <span>
                {quality.withoutAttachment.length ? (
                  <button type="button" className="cursor-pointer text-left underline decoration-dotted underline-offset-4 hover:text-primary"
                    onClick={() => openDetail('Movimientos sin soporte', quality.withoutAttachment, 'Adjunta el soporte para que queden completos')}>
                    <b className="num">{quality.withoutAttachment.length}</b> movimientos sin soporte
                  </button>
                ) : 'Todos los movimientos tienen soporte'}
              </span>
            </li>
            <li className="flex items-start gap-2">
              {quality.unreconciledAccounts.length ? <Landmark className="mt-0.5 size-4 text-amber-600" /> : <CheckCircle2 className="mt-0.5 size-4 text-emerald-600" />}
              <span>
                {quality.unreconciledAccounts.length ? <><b className="num">{quality.unreconciledAccounts.length}</b> cuentas sin conciliar de {formatMonth(quality.reconciliationMonth)}</> : 'Todas las cuentas están conciliadas'}
                {quality.unreconciledAccounts.length > 0 && <span className="block text-xs text-muted-foreground">{quality.unreconciledAccounts.join(', ')}</span>}
              </span>
            </li>
            <li className="flex items-start gap-2">
              {quality.duplicates ? <Copy className="mt-0.5 size-4 text-amber-600" /> : <CheckCircle2 className="mt-0.5 size-4 text-emerald-600" />}
              <span>{quality.duplicates ? <><b className="num">{quality.duplicates}</b> posibles duplicados</> : 'Sin posibles duplicados'}</span>
            </li>
          </ul>
        )}
      </section>
    </div>
  )
}
