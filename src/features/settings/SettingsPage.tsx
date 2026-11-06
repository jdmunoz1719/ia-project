import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckCircle2, FolderTree, Lock, Pencil, Plus, Trash2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DateInput, EmptyState, Field, LoadingRows, Money, MoneyInput, PageHeader, Selector, Tag } from '@/components/common'
import { useServiceQuery } from '@/hooks/useServiceQuery'
import { useSession } from '@/hooks/useSession'
import { api, type Config } from '@/services/api'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'

type Collection = 'entities' | 'accounts' | 'projects' | 'categories' | 'counterparties' | 'assignees'
type Item = Record<string, unknown> & { id: string; name: string }
type FieldDef = { key: string; label: string; type: 'text' | 'alias' | 'entity' | 'kind' | 'money' | 'date' | 'check'; required?: boolean }

const KIND_LABEL: Record<string, string> = { income: 'Ingreso', cost_of_sales: 'Costo de ventas', operating_expense: 'Gasto operativo', financial: 'Gasto financiero', investment: 'Inversión' }
const NAME: FieldDef = { key: 'name', label: 'Nombre', type: 'text', required: true }
const ALIAS: FieldDef = { key: 'alias', label: 'Alias (separados por coma)', type: 'alias' }
const ENTITY: FieldDef = { key: 'entityId', label: 'Empresa', type: 'entity', required: true }

// Qué se edita en cada pestaña. Los alias ayudan a la IA a reconocer nombres en mensajes y facturas.
const TABS: { id: string; label: string; col?: Collection; singular?: string; fields?: FieldDef[] }[] = [
  { id: 'empresas', label: 'Empresas', col: 'entities', singular: 'empresa', fields: [NAME, ALIAS, { key: 'description', label: 'Descripción', type: 'text' }, { key: 'isPersonal', label: 'Es de asuntos personales', type: 'check' }] },
  { id: 'cuentas', label: 'Cuentas', col: 'accounts', singular: 'cuenta', fields: [ENTITY, { key: 'bank', label: 'Banco', type: 'text', required: true }, NAME, ALIAS, { key: 'openingBalance', label: 'Saldo inicial', type: 'money' }, { key: 'openingBalanceDate', label: 'Fecha del saldo inicial', type: 'date' }] },
  { id: 'proyectos', label: 'Proyectos', col: 'projects', singular: 'proyecto', fields: [ENTITY, NAME, ALIAS] },
  { id: 'categorias', label: 'Categorías', col: 'categories', singular: 'categoría', fields: [NAME, { key: 'kind', label: 'Tipo', type: 'kind', required: true }, ALIAS] },
  { id: 'terceros', label: 'Terceros', col: 'counterparties', singular: 'tercero', fields: [NAME, ALIAS] },
  { id: 'responsables', label: 'Responsables', col: 'assignees', singular: 'responsable', fields: [NAME, { key: 'position', label: 'Cargo', type: 'text' }] },
  { id: 'drive', label: 'Google Drive' },
  { id: 'historial', label: 'Registro de cambios' },
]

export default function SettingsPage() {
  const [params, setParams] = useSearchParams()
  const tab = TABS.find((t) => t.id === params.get('tab')) ?? TABS[0]
  const { can } = useSession()
  const { data: cfg, loading } = useServiceQuery(() => api.settings.get(), [])

  return (
    <div>
      <PageHeader title="Configuración" description="Administra las empresas, cuentas y listas que usa la IA para proponer movimientos."
        actions={!can('configure') ? <Tag tone="amber"><Lock />Tu rol solo puede consultar</Tag> : undefined} />
      <div role="tablist" aria-label="Secciones" className="mb-4 flex flex-wrap gap-x-1 border-b">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={t.id === tab.id} type="button" onClick={() => setParams({ tab: t.id })}
            className={cn('min-h-11 shrink-0 border-b-2 px-3 text-sm', t.id === tab.id ? 'border-primary font-medium text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}>{t.label}</button>
        ))}
      </div>
      {tab.id === 'historial' ? <HistoryTab /> : tab.id === 'drive' ? <DriveTab canConfigure={can('configure')} /> : loading || !cfg ? <LoadingRows rows={5} /> : <CrudTab key={tab.id} tab={tab} cfg={cfg} canConfigure={can('configure')} />}
    </div>
  )
}

function CrudTab({ tab, cfg, canConfigure }: { tab: (typeof TABS)[number]; cfg: Config; canConfigure: boolean }) {
  const col = tab.col!
  const fields = tab.fields!
  const items = cfg[col] as unknown as Item[]
  const [editing, setEditing] = useState<Item>()
  const [error, setError] = useState<string>()
  const [confirming, setConfirming] = useState<string>()
  const entityName = (id: unknown) => cfg.entities.find((e) => e.id === id)?.name ?? '—'

  const save = async () => {
    if (!editing) return
    const missing = fields.find((f) => f.required && !editing[f.key])
    if (missing) return setError(`Completa el campo "${missing.label}".`)
    setError(undefined)
    try { await api.settings.save(col, editing as never); setEditing(undefined) } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar. Inténtalo de nuevo.') }
  }
  const remove = async (it: Item) => {
    setConfirming(undefined); setError(undefined)
    try { await api.settings.remove(col, it.id) } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo eliminar.') }
  }
  const blank = (): Item => ({ id: '', name: '', ...(fields.some((f) => f.key === 'entityId') ? { entityId: cfg.entities[0]?.id } : {}), ...(col === 'categories' ? { kind: 'operating_expense' } : {}), alias: [], ...(col === 'accounts' ? { openingBalance: 0, openingBalanceDate: '2026-05-01' } : {}) })
  const summary = (it: Item) => [fields.some((f) => f.key === 'entityId') && entityName(it.entityId), col === 'accounts' && String(it.bank), col === 'categories' && KIND_LABEL[String(it.kind)], col === 'assignees' && String(it.position ?? ''), Array.isArray(it.alias) && it.alias.length > 0 && `alias: ${(it.alias as string[]).join(', ')}`].filter(Boolean).join(' · ')

  return (
    <div className="space-y-3">
      <div className="flex justify-end"><Button onClick={() => { setError(undefined); setEditing(blank()) }} disabled={!canConfigure}><Plus />Agregar {tab.singular}</Button></div>
      {error && <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><XCircle className="mt-0.5 size-4 shrink-0" />{error}</p>}

      {editing && (
        <form className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save() }}>
          <h2 className="font-medium sm:col-span-2">{editing.id ? 'Editar' : 'Nueva'} {tab.singular}</h2>
          {fields.map((f) => (
            <Field key={f.key} label={f.label + (f.required ? ' *' : '')}>
              {f.type === 'entity' ? <Selector value={String(editing[f.key] ?? '')} onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value })} options={cfg.entities.map((x) => ({ value: x.id, label: x.name }))} />
                : f.type === 'kind' ? <Selector value={String(editing[f.key] ?? '')} onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value })} options={Object.entries(KIND_LABEL).map(([value, label]) => ({ value, label }))} />
                : f.type === 'money' ? <MoneyInput value={editing[f.key] as number} onChange={(v) => setEditing({ ...editing, [f.key]: v ?? 0 })} />
                : f.type === 'date' ? <DateInput value={editing[f.key] as string} onChange={(v) => setEditing({ ...editing, [f.key]: v })} />
                : f.type === 'check' ? <input type="checkbox" className="size-5" checked={!!editing[f.key]} onChange={(e) => setEditing({ ...editing, [f.key]: e.target.checked })} />
                : f.type === 'alias' ? <input className="h-8 rounded-lg border border-input bg-background px-2 text-sm" defaultValue={((editing[f.key] as string[]) ?? []).join(', ')} onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value.split(',').map((a) => a.trim()).filter(Boolean) })} />
                : <input className="h-8 rounded-lg border border-input bg-background px-2 text-sm" value={String(editing[f.key] ?? '')} onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value })} />}
            </Field>
          ))}
          <div className="flex gap-2 sm:col-span-2"><Button type="submit">Guardar</Button><Button type="button" variant="outline" onClick={() => { setEditing(undefined); setError(undefined) }}>Cancelar</Button></div>
        </form>
      )}

      {items.length === 0 ? <EmptyState title={`Aún no hay ${tab.label.toLowerCase()}`} text={`Agrega la primera con "Agregar ${tab.singular}".`} /> : (
        <ul className="divide-y rounded-xl border bg-card">
          {items.map((it) => (
            <li key={it.id} className="flex items-center gap-2 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{it.name}</p>
                <p className="truncate text-xs text-muted-foreground">{summary(it)}{col === 'accounts' && <> · saldo inicial <Money value={Number(it.openingBalance)} /></>}</p>
              </div>
              <Button size="icon" variant="ghost" className="size-11" aria-label={`Editar ${it.name}`} disabled={!canConfigure} onClick={() => { setError(undefined); setEditing(it) }}><Pencil /></Button>
              {confirming === it.id ? (
                <>
                  <Button size="sm" variant="destructive" className="h-11" onClick={() => remove(it)}>Sí, eliminar</Button>
                  <Button size="sm" variant="outline" className="h-11" onClick={() => setConfirming(undefined)}>Cancelar</Button>
                </>
              ) : (
                <Button size="icon" variant="ghost" className="size-11 text-red-600" aria-label={`Eliminar ${it.name}`} disabled={!canConfigure} onClick={() => setConfirming(it.id)}><Trash2 /></Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function HistoryTab() {
  const { data, loading } = useServiceQuery(() => api.settings.history(), [])
  if (loading || !data) return <LoadingRows rows={6} />
  if (!data.length) return <EmptyState title="Aún no hay cambios" text="Aquí verás quién hizo qué y cuándo." />
  return (
    <div>
      <p className="mb-2 text-sm text-muted-foreground">Solo lectura: este registro no se puede editar ni borrar.</p>
      <ul className="divide-y rounded-xl border bg-card">
        {data.map((h, i) => (
          <li key={i} className="p-3 text-sm">
            <p><span className="font-medium">{h.action}</span> · {h.objectName}</p>
            <p className="text-xs text-muted-foreground">{h.user} · {formatDateTime(h.date)}{h.detail ? ` · ${h.detail}` : ''}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}

const FOLDERS = ['Caja Clara/', '  Empresa A/ · Empresa B/ · Empresa C/ · Empresa D/ · Empresa E/', '    2026/', '      10/ (mes)', '        Facturas/ · Recibos/ · Extractos/ · Contratos/', '  Asuntos personales/', '    2026/10/Recibos/']

function DriveTab({ canConfigure }: { canConfigure: boolean }) {
  const [progress, setProgress] = useState<{ pct: number; file: string }>()
  const [result, setResult] = useState<Awaited<ReturnType<typeof api.settings.driveImport>>>()
  const [running, setRunning] = useState(false)
  const run = async () => {
    setRunning(true); setResult(undefined); setProgress({ pct: 0, file: '' })
    setResult(await api.settings.driveImport((pct, file) => setProgress({ pct, file })))
    setRunning(false)
  }
  return (
    <div className="space-y-4">
      <Tag tone="gray">Conexión simulada: en la demo no se toca tu Drive real</Tag>
      <section className="rounded-xl border bg-card p-4">
        <h2 className="mb-2 flex items-center gap-2 font-medium"><FolderTree className="size-4" />Estructura de carpetas propuesta</h2>
        <pre className="overflow-x-auto text-xs leading-relaxed">{FOLDERS.join('\n')}</pre>
        <p className="mt-2 text-xs text-muted-foreground">Cada archivo que subas a su carpeta entra a la bandeja para que lo revises.</p>
      </section>
      <section className="rounded-xl border bg-card p-4">
        <h2 className="mb-1 font-medium">Carga inicial</h2>
        <p className="mb-3 text-sm text-muted-foreground">Lee los archivos que ya existen en estas carpetas y los envía a la bandeja. Los duplicados se omiten.</p>
        <Button onClick={run} disabled={running || !canConfigure}>{running ? 'Cargando…' : 'Carga inicial'}</Button>
        {progress && (
          <div className="mt-3" role="status">
            <div role="progressbar" aria-valuenow={progress.pct} aria-valuemin={0} aria-valuemax={100} className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${progress.pct}%` }} /></div>
            <p className="mt-1 truncate text-xs text-muted-foreground"><span className="num">{progress.pct} %</span>{running && progress.file ? ` · ${progress.file}` : ''}</p>
          </div>
        )}
        {result && (
          <div className="mt-3 space-y-3">
            <p className="flex items-center gap-2 text-sm font-medium text-emerald-700"><CheckCircle2 className="size-4" />Carga terminada</p>
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {([['Encontrados', result.found], ['Cargados', result.loaded], ['Omitidos (duplicados)', result.skipped], ['Fallidos', result.failed]] as const).map(([l, v]) => (
                <div key={l} className="rounded-lg border p-3"><dt className="text-xs text-muted-foreground">{l}</dt><dd className="num text-xl font-semibold">{v}</dd></div>
              ))}
            </dl>
            <p className="text-xs text-muted-foreground">{result.detail.map((d) => `${d.folder}: ${d.files}`).join(' · ')}</p>
          </div>
        )}
      </section>
    </div>
  )
}
