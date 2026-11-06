import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  AlertTriangle, ArrowDownLeft, ArrowLeft, ArrowLeftRight, ArrowUpRight, Check, CheckCircle2, Copy, Eye, ListPlus, Loader2,
  Plus, RefreshCw, Sparkles, SplitSquareHorizontal, Trash2, Undo2, X, XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, LoadingRows, Confidence, Tag, DateText, MoneyInput, DateInput, Money, Selector, EmptyState } from '@/components/common'
import { openTransaction, ChannelIcon, AttachmentViewer, type Mark } from '@/components/panels'
import { useServiceQuery } from '@/hooks/useServiceQuery'
import { useSession } from '@/hooks/useSession'
import { api, TYPE_NAME, type Config } from '@/services/api'
import type { ProposalFields, Proposal, TransactionType } from '@/domain/types'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'

const TYPES: (TransactionType | 'task')[] = ['expense', 'cost', 'income', 'interest', 'project_investment', 'transfer', 'intercompany_payment', 'loan_payment', 'loan_disbursement', 'task']
const KINDS_BY_TYPE: Record<string, string[]> = {
  income: ['income'], expense: ['operating_expense', 'financial'], cost: ['cost_of_sales'], interest: ['financial'],
  project_investment: ['investment'], loan_payment: ['financial'], task: ['operating_expense', 'cost_of_sales', 'financial'],
}
const INFLOW_TYPES = ['income', 'loan_disbursement']

export default function ReviewPage() {
  const { id = '' } = useParams()
  const { data, loading, error } = useServiceQuery(() => api.inbox.get(id), [id])
  const { data: cfg } = useServiceQuery(() => api.settings.get(), [])
  const [active, setActive] = useState<string | null>(null)
  const [tab, setTab] = useState<'revision' | 'historial'>('revision')
  const { can } = useSession()

  if (error) return <EmptyState title="No se encontró el elemento" text="Puede que se haya reiniciado la demo." />
  if (loading || !data || !cfg) return <LoadingRows rows={8} />
  const { item, attachment, history, duplicateOriginal } = data
  const marks: Mark[] = item.proposals.flatMap((p) => p.evidence.map((e) => ({ ...e, markKey: `${p.id}:${e.field}` })))
  const pending = item.proposals.filter((p) => p.status === 'pending').length
  const processing = item.status === 'processing'

  const action = async (fn: () => Promise<unknown>, ok?: string) => { try { await fn(); if (ok) toast.success(ok) } catch (e) { toast.error((e as Error).message) } }

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="icon" nativeButton={false} render={<Link to="/bandeja" />} aria-label="Volver a la bandeja"><ArrowLeft /></Button>
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted"><ChannelIcon channel={item.channel} /></span>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold">{attachment.name}</h1>
            <p className="text-xs text-muted-foreground">Recibido el {formatDateTime(item.receivedAt)} · {processing ? 'la IA está leyendo…' : `${item.proposals.length} propuesta(s), ${pending} por revisar`}</p>
          </div>
        </div>
        {can('upload') && (
          <div className="flex flex-wrap gap-2 sm:ml-auto">
            <Button variant="outline" size="sm" disabled={processing} onClick={() => action(() => api.inbox.reread(item.id), 'La IA está leyendo de nuevo')}><RefreshCw />Volver a leer</Button>
            <Button variant="outline" size="sm" disabled={processing} onClick={() => action(() => api.inbox.addManual(item.id, 'registro'))}><Plus />Registro</Button>
            <Button variant="outline" size="sm" disabled={processing} onClick={() => action(() => api.inbox.addManual(item.id, 'task'))}><ListPlus />Tarea</Button>
          </div>
        )}
      </div>

      {duplicateOriginal && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          <Copy className="size-4" /><span><b>Archivo repetido:</b> este mismo archivo ya se recibió el {formatDateTime(duplicateOriginal.receivedAt)}.</span>
          <Link to={`/bandeja/${duplicateOriginal.itemId}`} className="font-medium underline">Posible duplicado de… ver el original</Link>
        </div>
      )}

      <div className="mb-4 flex gap-1 border-b text-sm">
        {(['revision', 'historial'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn('-mb-px border-b-2 px-3 py-2', tab === t ? 'border-primary font-medium text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
            {t === 'revision' ? 'Revisión' : `Historial (${history.length})`}
          </button>
        ))}
      </div>

      {tab === 'historial' ? (
        history.length ? (
          <ol className="relative space-y-4 border-l pl-6">
            {history.map((h, i) => (
              <li key={i} className="text-sm">
                <span className="absolute -left-1.5 mt-1 size-3 rounded-full border-2 border-background bg-primary" />
                <p><b>{h.user}</b> · {h.action} <span className="text-muted-foreground">— {h.objectName}</span></p>
                <p className="text-xs text-muted-foreground">{formatDateTime(h.date)}{h.detail && ` · ${h.detail}`}</p>
              </li>
            ))}
          </ol>
        ) : <EmptyState title="Sin actividad registrada" text="Este elemento venía en los datos iniciales de la demo." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="lg:sticky lg:top-20 lg:self-start">
            <h2 className="mb-2 text-sm font-semibold">Original</h2>
            <div className="rounded-xl border bg-card p-4 lg:max-h-[calc(100svh-11rem)] lg:overflow-y-auto">
              <AttachmentViewer attachment={attachment} text={item.extractedText} marks={marks} active={active} isTranscript={item.isTranscript} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Pasa el cursor por un campo de la propuesta para ver de dónde salió el dato.</p>
          </section>
          <section className="space-y-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="size-4 text-primary" />Lo que propone la IA</h2>
            {processing ? <Reading /> : item.proposals.map((p, i) => (
              <ProposalCard key={`${p.id}:${p.status}`} n={i + 1} itemId={item.id} p={p} cfg={cfg} onHover={setActive} />
            ))}
          </section>
        </div>
      )}
    </div>
  )
}

const AI_STEPS = ['Leyendo el contenido original', 'Identificando montos y fechas', 'Reconociendo empresas, cuentas y proyectos', 'Proponiendo registros']

function Reading() {
  const [n, setN] = useState(0)
  useEffect(() => { const t = setInterval(() => setN((x) => Math.min(x + 1, AI_STEPS.length - 1)), 600); return () => clearInterval(t) }, [])
  return (
    <div className="rounded-xl border bg-card p-5">
      <p className="mb-4 flex items-center gap-2 text-sm font-medium"><Loader2 className="size-4 animate-spin text-primary" />La IA está leyendo…</p>
      <ol className="space-y-2 text-sm">
        {AI_STEPS.map((p, i) => <li key={p} className={cn('flex items-center gap-2 transition', i > n && 'opacity-40')}>{i < n ? <Check className="size-4 text-emerald-600" /> : i === n ? <Loader2 className="size-4 animate-spin" /> : <span className="size-4" />}{p}</li>)}
      </ol>
      <div className="mt-5 space-y-2"><div className="h-3 w-2/3 animate-pulse rounded bg-muted" /><div className="h-3 w-1/2 animate-pulse rounded bg-muted" /></div>
    </div>
  )
}

function ProposalCard({ n, itemId, p, cfg, onHover }: { n: number; itemId: string; p: Proposal; cfg: Config; onHover: (c: string | null) => void }) {
  const [type, setType] = useState<TransactionType | 'task'>(p.type)
  const [c, setC] = useState<ProposalFields>(() => structuredClone(p.fields))
  const [effect, setEffect] = useState<Awaited<ReturnType<typeof api.inbox.effect>>>()
  const [busy, setBusy] = useState(false)
  const { can } = useSession()
  const changed = type !== p.type || JSON.stringify(c) !== JSON.stringify(p.fields)
  const isOpen = p.status === 'pending'
  const isTask = type === 'task'

  useEffect(() => { if (!isTask && isOpen) api.inbox.effect(type as TransactionType, c).then(setEffect) }, [type, c, isTask, isOpen])

  const upd = (x: Partial<ProposalFields>) => setC((v) => ({ ...v, ...x }))
  const h = (field: string) => ({ onMouseEnter: () => onHover(`${p.id}:${field}`), onMouseLeave: () => onHover(null), onFocus: () => onHover(`${p.id}:${field}`), onBlur: () => onHover(null) })
  const allocs = c.allocations ?? []
  const isSplit = allocs.length > 1
  const setAmount = (m?: number) => upd({ amount: m, allocations: allocs.length === 1 ? [{ ...allocs[0], amount: m ?? 0 }] : allocs })
  const setOwner = (entityId: string) => upd({ allocations: entityId ? [{ entityId, amount: c.amount ?? 0 }] : [] })
  const isInflowAccount = INFLOW_TYPES.includes(type)
  const accountKey = isInflowAccount ? 'destinationAccountId' : 'sourceAccountId'
  const setAccount = (id: string) => {
    const ent = cfg.accounts.find((x) => x.id === id)?.entityId
    upd({ [accountKey]: id || undefined, payerEntityId: ent ?? c.payerEntityId, allocations: allocs.length ? allocs : ent ? [{ entityId: ent, amount: c.amount ?? 0 }] : [] })
  }
  const accountOptions = cfg.accounts.map((x) => ({ value: x.id, label: x.name, group: cfg.entities.find((e) => e.id === x.entityId)?.name }))
  const entityOptions = cfg.entities.map((e) => ({ value: e.id, label: e.name }))
  const projectOptions = (ent?: string) => cfg.projects.filter((x) => x.entityId === ent).map((x) => ({ value: x.id, label: x.name }))
  const categoryOptions = cfg.categories.filter((x) => (KINDS_BY_TYPE[type] ?? []).includes(x.kind)).map((x) => ({ value: x.id, label: x.name }))
  const ic = !isTask && c.payerEntityId && allocs.some((a) => a.entityId && a.entityId !== c.payerEntityId)

  const prefillInstallment = async () => {
    if (!c.loanId) return
    const d = await api.loans.detail(c.loanId)
    if (!d.next) return toast.info('El crédito no tiene cuotas pendientes')
    const f = d.next
    upd({ installmentNumber: f.number, amount: f.total, loanPaymentBreakdown: { capital: f.capital, interest: f.interest, fees: f.fees }, sourceAccountId: c.sourceAccountId ?? d.loan.accountId, payerEntityId: c.payerEntityId ?? d.loan.entityId, allocations: [{ entityId: d.loan.entityId, amount: f.total }] })
  }

  const run = async (fn: () => Promise<unknown>, ok: string, onView?: (r: unknown) => void) => {
    setBusy(true)
    try { const r = await fn(); toast.success(ok, onView ? { action: { label: 'Ver', onClick: () => onView(r) } } : undefined) } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }
  const approve = () => run(() => api.inbox.approve(itemId, p.id, c, type, changed), isTask ? 'Tarea creada' : 'Movimiento aprobado',
    (r) => { const x = r as { type: string; id: string }; if (x.type === 'transaction') openTransaction(x.id) })

  if (!isOpen) {
    const tone = p.status === 'approved' || p.status === 'corrected' ? 'green' : p.status === 'duplicate' ? 'amber' : 'gray'
    const label = { approved: 'Aprobada', corrected: 'Corregida y aprobada', discarded: 'Descartada', rejected: 'Rechazada', duplicate: 'Marcada como duplicado', pending: '' }[p.status]
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-muted/30 px-4 py-3 text-sm" {...h('amount')}>
        <span className="num text-xs text-muted-foreground">#{n}</span>
        <Tag tone={tone}>{tone === 'green' ? <CheckCircle2 /> : <XCircle />}{label}</Tag>
        <span className="font-medium">{TYPE_NAME[p.type]}</span>
        <span className="min-w-0 flex-1 truncate text-muted-foreground">{p.fields.taskTitle ?? p.fields.description}</span>
        {p.fields.amount ? <Money value={p.fields.amount} className="font-medium" /> : null}
        {p.transactionId && <Button size="xs" variant="outline" onClick={() => openTransaction(p.transactionId!)}><Eye />Ver movimiento</Button>}
        {['discarded', 'rejected', 'duplicate'].includes(p.status) && can('approve') && <Button size="xs" variant="ghost" onClick={() => run(() => api.inbox.setStatus(itemId, p.id, 'pending'), 'Propuesta reabierta')}><Undo2 />Reabrir</Button>}
      </div>
    )
  }

  return (
    <article className={cn('rounded-xl border bg-card shadow-sm', p.possibleDuplicateOf && 'border-amber-300')}>
      <header className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <span className="num text-xs text-muted-foreground">#{n}</span>
        <span className="font-semibold">{TYPE_NAME[type]}</span>
        {ic && <Tag tone="amber"><ArrowLeftRight />Entre empresas</Tag>}
        {isSplit && <Tag tone="blue"><SplitSquareHorizontal />Repartido</Tag>}
        {changed && <Tag tone="blue">Corregida</Tag>}
        <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">Confianza <Confidence value={p.confidence} /></span>
      </header>

      <div className="space-y-4 p-4">
        {p.possibleDuplicateOf && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <Copy className="size-4" />Posible duplicado de un movimiento ya aprobado
            <button className="font-medium underline" onClick={() => openTransaction(p.possibleDuplicateOf!)}>ver el original</button>
          </div>
        )}
        {p.note && <p className="flex items-start gap-1.5 text-xs text-amber-800"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" />{p.note}</p>}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo"><Selector value={type} onChange={(e) => setType(e.target.value as TransactionType)} options={TYPES.map((t) => ({ value: t, label: TYPE_NAME[t] }))} /></Field>
          {isTask ? (
            <>
              <div {...h('due')}><Field label="Vence"><DateInput value={c.due} onChange={(v) => upd({ due: v })} /></Field></div>
              <div className="col-span-2" {...h('description')}><Field label="Tarea"><Input value={c.taskTitle ?? ''} onChange={(e) => upd({ taskTitle: e.target.value })} /></Field></div>
              <div {...h('entityId')}><Field label="Empresa"><Selector value={allocs[0]?.entityId ?? ''} onChange={(e) => setOwner(e.target.value)} options={entityOptions} emptyLabel="(Sin empresa)" /></Field></div>
              <Field label="Crédito vinculado"><Selector value={c.loanId ?? ''} onChange={(e) => upd({ loanId: e.target.value || undefined })} options={cfg.loans.map((x) => ({ value: x.id, label: x.name }))} emptyLabel="(Ninguno)" /></Field>
            </>
          ) : (
            <>
              <div {...h('amount')}><Field label="Monto"><MoneyInput value={c.amount} onChange={setAmount} /></Field></div>
              <div {...h('date')}><Field label="Fecha"><DateInput value={c.date} onChange={(v) => upd({ date: v })} /></Field></div>
              <div {...h(accountKey)}><Field label={isInflowAccount ? 'Entra a la cuenta' : type === 'transfer' || type === 'intercompany_payment' ? 'Sale de la cuenta' : 'Sale de la cuenta (paga)'}>
                <Selector value={c[accountKey] ?? ''} onChange={(e) => setAccount(e.target.value)} options={accountOptions} emptyLabel="(Elegir cuenta)" /></Field></div>
              {(type === 'transfer' || type === 'intercompany_payment') ? (
                <div {...h('destinationAccountId')}><Field label="Entra a la cuenta"><Selector value={c.destinationAccountId ?? ''} onChange={(e) => upd({ destinationAccountId: e.target.value || undefined })} options={accountOptions} emptyLabel="(Elegir cuenta)" /></Field></div>
              ) : !isSplit ? (
                <div {...h('entityId')}><Field label={isInflowAccount ? 'Ingreso de la empresa' : 'Gasto de la empresa'}><Selector value={allocs[0]?.entityId ?? ''} onChange={(e) => setOwner(e.target.value)} options={entityOptions} emptyLabel="(Sin identificar)" /></Field></div>
              ) : <div />}
              {!isSplit && !(type === 'transfer' || type === 'intercompany_payment') && (
                <div {...h('projectId')}><Field label="Proyecto"><Selector value={allocs[0]?.projectId ?? ''} disabled={!allocs[0]} onChange={(e) => upd({ allocations: [{ ...allocs[0], projectId: e.target.value || undefined }] })} options={projectOptions(allocs[0]?.entityId)} emptyLabel="(Ninguno)" /></Field></div>
              )}
              {categoryOptions.length > 0 && <div {...h('categoryId')}><Field label="Categoría"><Selector value={c.categoryId ?? ''} onChange={(e) => upd({ categoryId: e.target.value || undefined })} options={categoryOptions} emptyLabel="(Sin categoría)" /></Field></div>}
              <div {...h('counterpartyId')}><Field label="Tercero"><Selector value={c.counterpartyId ?? ''} onChange={(e) => upd({ counterpartyId: e.target.value || undefined })} options={cfg.counterparties.map((x) => ({ value: x.id, label: x.name }))} emptyLabel="(Ninguno)" /></Field></div>
              {(type === 'loan_payment' || type === 'loan_disbursement') && (
                <Field label="Crédito"><Selector value={c.loanId ?? ''} onChange={(e) => upd({ loanId: e.target.value || undefined })} options={cfg.loans.map((x) => ({ value: x.id, label: `${x.name} · ${x.bank}` }))} emptyLabel="(Elegir crédito)" /></Field>
              )}
              <div className="col-span-2" {...h('description')}><Field label="Descripción"><Input value={c.description ?? ''} onChange={(e) => upd({ description: e.target.value })} /></Field></div>
            </>
          )}
        </div>

        {type === 'loan_payment' && (
          <div className="rounded-lg bg-muted/40 p-3">
            <div className="mb-2 flex items-center justify-between"><p className="text-xs font-medium">Desglose del pago {c.installmentNumber ? `· cuota ${c.installmentNumber}` : ''}</p><Button size="xs" variant="outline" disabled={!c.loanId} onClick={prefillInstallment}>Prellenar desde la tabla</Button></div>
            <div className="grid grid-cols-3 gap-2">
              {(['capital', 'interest', 'fees'] as const).map((k) => (
                <Field key={k} label={k === 'interest' ? 'Interés' : k[0].toUpperCase() + k.slice(1)}>
                  <MoneyInput value={c.loanPaymentBreakdown?.[k]} onChange={(v) => upd({ loanPaymentBreakdown: { capital: 0, interest: 0, fees: 0, ...c.loanPaymentBreakdown, [k]: v ?? 0 } })} />
                </Field>
              ))}
            </div>
          </div>
        )}

        {!isTask && !(type === 'transfer' || type === 'intercompany_payment') && (
          <SplitEditor c={c} cfg={cfg} upd={upd} projectOptions={projectOptions} />
        )}

        {!isTask && effect && (
          <div className={cn('rounded-lg border p-3', ic || isSplit ? 'border-amber-200 bg-amber-50/40' : 'bg-muted/30')}>
            <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Vista previa del efecto</p>
            {effect.errors.length ? (
              <ul className="space-y-1 text-sm text-amber-800">{effect.errors.map((e) => <li key={e} className="flex items-center gap-1.5"><AlertTriangle className="size-3.5" />{e}</li>)}</ul>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {effect.phrases.map((f, i) => (
                  <li key={i} className={cn('flex items-center gap-2', f.tone === 'ic' && 'font-medium text-amber-900')}>
                    {f.tone === 'outflow' ? <ArrowUpRight className="size-4 text-red-600" /> : f.tone === 'inflow' ? <ArrowDownLeft className="size-4 text-emerald-600" /> : f.tone === 'ic' ? <ArrowLeftRight className="size-4 text-amber-600" /> : <Check className="size-4 text-muted-foreground" />}
                    {f.text}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-[11px] text-muted-foreground">Nada de esto afecta saldos ni informes hasta que se apruebe.</p>
          </div>
        )}
      </div>

      <footer className="flex flex-wrap items-center gap-2 border-t px-4 py-3">
        <ActionsHint can={can('approve')}>
          <Button onClick={approve} disabled={busy || !can('approve') || (!isTask && !!effect?.errors.length)} className="bg-emerald-600 text-white hover:bg-emerald-700">
            {busy ? <Loader2 className="animate-spin" /> : <Check />}{changed ? 'Corregir y aprobar' : 'Aprobar'}
          </Button>
          <Button variant="outline" disabled={busy || !can('approve')} onClick={() => run(() => api.inbox.setStatus(itemId, p.id, 'discarded'), 'Propuesta descartada')}><X />Descartar</Button>
          <Button variant="ghost" disabled={busy || !can('approve')} onClick={() => run(() => api.inbox.setStatus(itemId, p.id, 'rejected'), 'Propuesta rechazada')}><XCircle />Rechazar</Button>
          <Button variant="ghost" disabled={busy || !can('approve')} onClick={() => run(() => api.inbox.setStatus(itemId, p.id, 'duplicate'), 'Marcada como duplicado')}><Copy />Duplicado</Button>
        </ActionsHint>
        {changed && <Button variant="ghost" size="sm" className="ml-auto" onClick={() => { setType(p.type); setC(structuredClone(p.fields)) }}><Undo2 />Deshacer cambios</Button>}
      </footer>
    </article>
  )
}

function ActionsHint({ can, children }: { can: boolean; children: ReactNode }) {
  return (
    <>
      {children}
      {!can && <span className="w-full text-xs text-muted-foreground">Tu rol puede cargar y corregir, pero no aprobar. Un administrador debe aprobarla.</span>}
    </>
  )
}

/** Reparto de un gasto o ingreso entre varias empresas (por valor o por porcentaje). */
function SplitEditor({ c, cfg, upd, projectOptions }: { c: ProposalFields; cfg: Config; upd: (x: Partial<ProposalFields>) => void; projectOptions: (e?: string) => { value: string; label: string }[] }) {
  const allocs = useMemo(() => c.allocations ?? [], [c.allocations])
  const total = c.amount ?? 0
  if (allocs.length <= 1) {
    return (
      <button className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline disabled:opacity-50" disabled={!allocs.length || !total}
        onClick={() => { const half = Math.round(total / 2); upd({ allocations: [{ ...allocs[0], amount: total - half }, { entityId: '', amount: half }] }) }}>
        <SplitSquareHorizontal className="size-3.5" />Repartir entre varias empresas
      </button>
    )
  }
  const set = (i: number, x: Partial<(typeof allocs)[number]>) => upd({ allocations: allocs.map((a, j) => (j === i ? { ...a, ...x } : a)) })
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex items-center justify-between"><p className="text-xs font-semibold">Reparto</p>
        <button className="text-xs text-primary hover:underline" onClick={() => { const base = Math.floor(total / allocs.length); upd({ allocations: allocs.map((a, i) => ({ ...a, amount: i === allocs.length - 1 ? total - base * (allocs.length - 1) : base })) }) }}>Partes iguales</button>
      </div>
      {allocs.map((a, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_110px_64px_24px] items-center gap-2">
          <Selector value={a.entityId} onChange={(e) => set(i, { entityId: e.target.value, projectId: undefined })} options={cfg.entities.map((e) => ({ value: e.id, label: e.name }))} emptyLabel="Empresa" />
          <Selector value={a.projectId ?? ''} onChange={(e) => set(i, { projectId: e.target.value || undefined })} options={projectOptions(a.entityId)} emptyLabel="Proyecto" />
          <MoneyInput value={a.amount} onChange={(v) => set(i, { amount: v ?? 0 })} />
          <div className="relative">
            <input inputMode="decimal" aria-label="Porcentaje" className="num h-8 w-full rounded-lg border border-input bg-background pr-5 pl-1 text-right text-sm"
              value={total ? String(Math.round((a.amount / total) * 1000) / 10).replace('.', ',') : ''}
              onChange={(e) => { const pct = parseFloat(e.target.value.replace(',', '.')); if (!isNaN(pct)) set(i, { amount: Math.round((total * pct) / 100) }) }} />
            <span className="absolute top-1/2 right-1.5 -translate-y-1/2 text-xs text-muted-foreground">%</span>
          </div>
          <button onClick={() => upd({ allocations: allocs.filter((_, j) => j !== i) })} aria-label="Quitar" className="text-muted-foreground hover:text-red-600"><Trash2 className="size-4" /></button>
        </div>
      ))}
      <button className="flex items-center gap-1 text-xs text-primary hover:underline" onClick={() => upd({ allocations: [...allocs, { entityId: '', amount: 0 }] })}><Plus className="size-3" />Agregar empresa</button>
      <p className="text-xs text-muted-foreground">Total: <Money value={total} /> · <DateText iso={c.date} /></p>
    </div>
  )
}
