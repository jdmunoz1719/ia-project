import { useState } from 'react'
import { Download, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DateInput, EmptyState, Field, LoadingRows, Money, PageHeader, Selector, Tag } from '@/components/common'
import { Figure, openDetail } from '@/components/panels'
import { KPI_NAME, type KpiKey } from '@/domain/kpis'
import type { Scope } from '@/domain/ledger'
import { useServiceQuery } from '@/hooks/useServiceQuery'
import { useSession } from '@/hooks/useSession'
import { api } from '@/services/api'
import { formatDate, formatMonth } from '@/lib/format'

const KIND_LABEL: Record<string, string> = { income: 'Ingresos', cost_of_sales: 'Costo de ventas', operating_expense: 'Gastos operativos', financial: 'Gastos financieros' }
const KPI_ORDER: KpiKey[] = ['revenue', 'grossProfit', 'operatingResult', 'netResult', 'cashFlow', 'projectInvestment', 'cashBalance']
type Kind = 'group' | 'entity' | 'project'

/** Informes imprimibles por grupo, empresa o proyecto (contexto §10). Las cifras vienen de `api.reports`. */
export default function ReportsPage() {
  const { today } = useSession()
  const { data: cfg } = useServiceQuery(() => api.settings.get(), [])
  const [kind, setKind] = useState<Kind>('group')
  const [entityId, setEntityId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [personal, setPersonal] = useState(false)
  const [from, setFrom] = useState(() => `${today.slice(0, 7)}-01`)
  const [to, setTo] = useState(today)
  const [pkgEntity, setPkgEntity] = useState('')
  const [pkgMonth, setPkgMonth] = useState('')
  const [pkgMsg, setPkgMsg] = useState<{ ok: boolean; text: string }>()
  const [busy, setBusy] = useState(false)

  const entities = (cfg?.entities ?? []).filter((e) => !e.isPersonal)
  const projects = cfg?.projects ?? []
  const entity = entityId || entities[0]?.id || ''
  const project = projectId || projects[0]?.id || ''
  const scope: Scope | undefined = kind === 'group' ? { type: 'group', includePersonal: personal } : kind === 'entity' ? (entity ? { type: 'entity', entityId: entity } : undefined) : (project ? { type: 'project', projectId: project } : undefined)
  const scopeName = kind === 'group' ? `Grupo${personal ? ' + asuntos personales' : ''}` : kind === 'entity' ? cfg?.entities.find((e) => e.id === entity)?.name : projects.find((p) => p.id === project)?.name

  const { data: report, loading, refreshing, error } = useServiceQuery(() => (scope ? api.reports.report(scope, from, to) : Promise.resolve(undefined)), [JSON.stringify(scope), from, to])

  // Últimos 12 meses desde la fecha de la demo, para el paquete del contador.
  const months = Array.from({ length: 12 }, (_, i) => { const d = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1 - i, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` })
  const pkgE = pkgEntity || entities[0]?.id || ''
  const pkgM = pkgMonth || months[0]

  const download = async () => {
    setBusy(true); setPkgMsg(undefined)
    try {
      const r = await api.reports.accountantPackage(pkgE, pkgM)
      const url = URL.createObjectURL(new Blob([r.csv], { type: 'text/csv;charset=utf-8' }))
      const a = document.createElement('a'); a.href = url; a.download = r.fileName; a.click(); URL.revokeObjectURL(url)
      setPkgMsg({ ok: true, text: `Descargaste ${r.fileName}: ${r.movements} movimientos, ${r.withoutAttachment} sin soporte.` })
    } catch (e) {
      setPkgMsg({ ok: false, text: e instanceof Error ? e.message : 'No se pudo generar el paquete. Inténtalo de nuevo.' })
    } finally { setBusy(false) }
  }

  return (
    <div>
      <div className="print:hidden">
        <PageHeader title="Informes" description="Elige qué informe quieres y el periodo. Después puedes imprimirlo o guardarlo en PDF."
          actions={<Button onClick={() => window.print()} disabled={!report}><Printer />Imprimir</Button>} />

        <div className="mb-4 grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Informe por">
            <Selector value={kind} onChange={(e) => setKind(e.target.value as Kind)} options={[{ value: 'group', label: 'Grupo' }, { value: 'entity', label: 'Empresa' }, { value: 'project', label: 'Proyecto' }]} />
          </Field>
          {kind === 'entity' && <Field label="Empresa"><Selector value={entity} onChange={(e) => setEntityId(e.target.value)} options={entities.map((e) => ({ value: e.id, label: e.name }))} /></Field>}
          {kind === 'project' && <Field label="Proyecto"><Selector value={project} onChange={(e) => setProjectId(e.target.value)} options={projects.map((p) => ({ value: p.id, label: p.name }))} /></Field>}
          {kind === 'group' && <label className="flex min-h-8 items-center gap-2 self-end text-sm"><input type="checkbox" checked={personal} onChange={(e) => setPersonal(e.target.checked)} className="size-4" />Incluir asuntos personales</label>}
          <Field label="Desde"><DateInput value={from} onChange={setFrom} /></Field>
          <Field label="Hasta"><DateInput value={to} onChange={setTo} /></Field>
        </div>

        <section className="mb-6 rounded-xl border bg-card p-4" aria-labelledby="pkg">
          <h2 id="pkg" className="font-medium">Paquete para el contador</h2>
          <p className="mb-3 text-sm text-muted-foreground">Un archivo CSV con los movimientos de la empresa en el mes y la lista de sus soportes.</p>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Field label="Empresa"><Selector value={pkgE} onChange={(e) => setPkgEntity(e.target.value)} options={entities.map((e) => ({ value: e.id, label: e.name }))} /></Field>
            <Field label="Mes"><Selector value={pkgM} onChange={(e) => setPkgMonth(e.target.value)} options={months.map((m) => ({ value: m, label: formatMonth(m) }))} /></Field>
            <Button onClick={download} disabled={busy || !pkgE} className="h-8"><Download />{busy ? 'Generando…' : 'Paquete para el contador'}</Button>
          </div>
          {pkgMsg && <p role="status" className={pkgMsg.ok ? 'mt-2 text-sm text-emerald-700' : 'mt-2 text-sm text-red-600'}>{pkgMsg.text}</p>}
        </section>
      </div>

      {error && <p role="alert" className="text-sm text-red-600">{error.message}</p>}
      {(loading || refreshing) && <LoadingRows rows={6} />}
      {!loading && !scope && <EmptyState title="Elige qué informe quieres" text="Selecciona una empresa o un proyecto." />}
      {report && scope && !refreshing && (
        <article className="space-y-6 rounded-xl border bg-card p-4 sm:p-6 print:border-0 print:p-0">
          <header className="border-b pb-3">
            <h2 className="text-lg font-semibold">Informe de {scopeName}</h2>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">Del {formatDate(from)} al {formatDate(to)} · generado el {formatDate(report.generatedAt)} <Tag tone="gray">base caja</Tag></p>
          </header>

          <section>
            <h3 className="mb-2 font-medium">Indicadores</h3>
            <dl className="grid gap-x-8 sm:grid-cols-2">
              {KPI_ORDER.map((k) => (
                <div key={k} className="flex items-baseline justify-between gap-3 border-b py-1.5 text-sm">
                  <dt>{KPI_NAME[k]}</dt>
                  <dd className="font-medium"><Figure value={report.kpis[k].value} lines={report.kpis[k].lines} title={KPI_NAME[k]} color={k !== 'cashBalance'} className="inline-flex min-h-11 min-w-11 items-center justify-end" /></dd>
                </div>
              ))}
            </dl>
          </section>

          <section>
            <h3 className="mb-2 font-medium">Resultado por categoría</h3>
            {report.categories.length === 0 ? <p className="text-sm text-muted-foreground">No hay movimientos en este periodo.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-1.5 font-medium">Categoría</th><th className="py-1.5 font-medium">Tipo</th><th className="py-1.5 text-right font-medium">Valor</th></tr></thead>
                  <tbody>
                    {report.categories.map((c) => (
                      <tr key={c.kind + c.category} className="border-b">
                        <td className="py-1.5">{c.category}</td><td className="py-1.5 text-muted-foreground">{KIND_LABEL[c.kind] ?? c.kind}</td>
                        <td className="py-1.5 text-right">
                          <button type="button" className="inline-flex min-h-8 min-w-8 cursor-pointer items-center justify-end underline decoration-dotted underline-offset-4 hover:text-primary print:no-underline" aria-label={`${c.category}: ver los movimientos que forman la cifra`} title="Ver los movimientos que forman esta cifra"
                            onClick={() => openDetail(c.category, c.transactionIds, KIND_LABEL[c.kind])}><Money value={c.value} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {report.accounts.length > 0 && (
            <section>
              <h3 className="mb-2 font-medium">Saldos de cuentas al {formatDate(to)}</h3>
              <table className="w-full text-sm">
                <tbody>{report.accounts.map(({ account, balance }) => (
                  <tr key={account.id} className="border-b"><td className="py-1.5">{account.name} <span className="text-muted-foreground">· {account.bank}</span></td><td className="py-1.5 text-right"><Money value={balance} /></td></tr>
                ))}</tbody>
              </table>
            </section>
          )}
        </article>
      )}
    </div>
  )
}
