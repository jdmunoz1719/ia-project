// Cierres mensuales por cuenta: saldo del sistema vs. extracto, diferencia explicada, publicar y reabrir (contexto §10).
import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Lock, LockOpen, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DateText, EmptyState, Field, LoadingRows, Money, MoneyInput, PageHeader, Selector, Tag } from '@/components/common'
import { useServiceQuery } from '@/hooks/useServiceQuery'
import { useSession } from '@/hooks/useSession'
import { api } from '@/services/api'
import { formatMonth } from '@/lib/format'

type Row = Awaited<ReturnType<typeof api.monthCloses.list>>[number]
type Diff = { amount: number; explanation: string }

const errorText = (e: unknown) => (e instanceof Error ? e.message : 'No se pudo completar la acción. Intenta de nuevo.')

function CloseCard({ row, month, entityName, canEdit, onReopen }: { row: Row; month: string; entityName: string; canEdit: boolean; onReopen: () => void }) {
  const saved = row.monthClose
  const published = saved?.status === 'published'
  const [statement, setStatement] = useState<number | undefined>(saved?.statementBalance ?? undefined)
  const [diffs, setDiffs] = useState<Diff[]>(saved?.differences ?? [])
  const [amount, setAmount] = useState<number | undefined>()
  const [text, setText] = useState('')
  const [negative, setNegative] = useState(true)
  const [busy, setBusy] = useState(false)

  const dirty = statement !== (saved?.statementBalance ?? undefined) || JSON.stringify(diffs) !== JSON.stringify(saved?.differences ?? [])
  const canPublish = canEdit && !published && !dirty && row.statementBalance !== null && row.unexplained === 0
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true)
    try { await fn(); toast.success(ok) } catch (e) { toast.error(errorText(e)) } finally { setBusy(false) }
  }
  const addDiff = (d: Diff) => { setDiffs((x) => [...x, d]); setAmount(undefined); setText('') }

  return (
    <section className="rounded-xl border bg-card p-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-medium">{row.account.name}</h2>
          <p className="text-xs text-muted-foreground">{entityName} · {row.account.bank}</p>
        </div>
        {published
          ? <Tag tone="green"><Lock /> Cierre publicado</Tag>
          : row.unexplained === 0 && row.statementBalance !== null && !dirty
            ? <Tag tone="green"><CheckCircle2 /> Conciliada</Tag>
            : <Tag tone="amber"><AlertTriangle /> {row.statementBalance === null ? 'Falta el extracto' : 'Pendiente por explicar'}</Tag>}
      </header>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Saldo del sistema"><Money value={row.systemBalance} className="text-base font-semibold" /></Field>
        <Field label="Saldo del extracto (escríbelo)">
          <MoneyInput value={statement} onChange={setStatement} disabled={published || !canEdit} />
        </Field>
        <Field label="Diferencia">
          {row.difference === null ? <span className="text-sm text-muted-foreground">—</span> : <Money value={row.difference} sign color className="text-base font-semibold" />}
        </Field>
      </div>

      <div className="mt-3">
        <p className="text-xs font-medium text-muted-foreground">Explicaciones de la diferencia</p>
        {diffs.length === 0 && <p className="mt-1 text-sm text-muted-foreground">Sin explicaciones.</p>}
        <ul className="mt-1 divide-y">
          {diffs.map((d, i) => (
            <li key={i} className="flex items-center justify-between gap-2 py-1.5 text-sm">
              <span className="min-w-0">{d.explanation}</span>
              <span className="flex items-center gap-2">
                <Money value={d.amount} sign color />
                {!published && canEdit && (
                  <button type="button" aria-label="Quitar explicación" className="text-muted-foreground hover:text-red-600" onClick={() => setDiffs((x) => x.filter((_, j) => j !== i))}><Trash2 className="size-4" /></button>
                )}
              </span>
            </li>
          ))}
        </ul>
        {!published && canEdit && (
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_160px_auto_auto] sm:items-end">
            <Field label="Motivo"><Input className="h-8" value={text} placeholder="Ej.: GMF del mes" onChange={(e) => setText(e.target.value)} /></Field>
            <Field label="Valor">
              <div className="flex gap-1">
                <Selector className="w-14" value={negative ? '-' : '+'} onChange={(e) => setNegative(e.target.value === '-')} options={[{ value: '-', label: '−' }, { value: '+', label: '+' }]} aria-label="Signo" />
                <MoneyInput value={amount} onChange={setAmount} />
              </div>
            </Field>
            <Button type="button" variant="outline" size="sm" disabled={!amount || text.trim().length < 3} onClick={() => addDiff({ amount: negative ? -amount! : amount!, explanation: text.trim() })}><Plus /> Agregar</Button>
            {/* El saldo sin explicar lo calcula el servicio; aquí solo se usa. */}
            {!!row.unexplained && !dirty && (
              <Button type="button" variant="ghost" size="sm" disabled={text.trim().length < 3} title="Usa el motivo escrito para toda la diferencia pendiente" onClick={() => addDiff({ amount: row.unexplained!, explanation: text.trim() })}>Explicar todo</Button>
            )}
          </div>
        )}
        {row.unexplained !== null && row.unexplained !== 0 && !dirty && (
          <p className="mt-2 flex items-center gap-1 text-sm text-red-700"><AlertTriangle className="size-4" /> Quedan <Money value={row.unexplained} /> sin explicar. Agrega el motivo para poder publicar.</p>
        )}
      </div>

      <footer className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
        <div className="text-xs text-muted-foreground">
          {published && saved?.publishedAt && <>Publicado el <DateText iso={saved.publishedAt} /> · el mes está bloqueado.</>}
          {saved && saved.reopenings.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {saved.reopenings.map((r, i) => <li key={i}><LockOpen className="mr-1 inline size-3" /><DateText iso={r.date} /> · {r.user}: {r.reason}</li>)}
            </ul>
          )}
        </div>
        <div className="flex gap-2">
          {published ? (
            <Button variant="outline" size="sm" disabled={!canEdit} onClick={onReopen}><LockOpen /> Reabrir</Button>
          ) : (
            <>
              <Button variant="outline" size="sm" disabled={busy || !canEdit || !dirty || statement === undefined} onClick={() => run(() => api.monthCloses.save(row.account.id, month, statement!, diffs), 'Extracto guardado')}>Guardar</Button>
              <Button size="sm" disabled={busy || !canPublish} title={canPublish ? '' : 'Guarda el extracto y explica toda la diferencia'} onClick={() => run(() => api.monthCloses.publish(row.account.id, month), 'Cierre publicado: el mes quedó bloqueado')}><Lock /> Publicar cierre</Button>
            </>
          )}
        </div>
      </footer>
    </section>
  )
}

export default function MonthClosesPage() {
  const { can } = useSession()
  const { data: months } = useServiceQuery(() => api.monthCloses.months(), [])
  const [picked, setPicked] = useState<string>()
  const month = picked ?? months?.[1] ?? months?.[0]
  // Se guarda el mes junto con las filas para no pintar las del mes anterior mientras carga el nuevo.
  const { data: result, loading } = useServiceQuery(async () => ({ month, rows: month ? await api.monthCloses.list(month) : [] }), [month])
  const rows = result && result.month === month ? result.rows : undefined
  const { data: cfg } = useServiceQuery(() => api.settings.get(), [])
  const [reopening, setReopening] = useState<Row>()
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const reopen = async () => {
    if (!reopening || !month) return
    setBusy(true)
    try { await api.monthCloses.reopen(reopening.account.id, month, reason); toast.success('Cierre reabierto. El motivo quedó en el historial.'); setReopening(undefined); setReason('') }
    catch (e) { toast.error(errorText(e)) } finally { setBusy(false) }
  }

  return (
    <div>
      <PageHeader
        title="Cierres"
        description="Compara el saldo del sistema con el extracto de cada cuenta. Al publicar, el mes queda bloqueado."
        actions={<Selector aria-label="Mes" className="w-44" value={month ?? ''} onChange={(e) => setPicked(e.target.value)} options={(months ?? []).map((m) => ({ value: m, label: formatMonth(m) }))} />}
      />
      {!can('edit') && <p className="mb-3 text-sm text-muted-foreground">Tu rol solo puede consultar los cierres.</p>}
      {loading || !rows ? <LoadingRows rows={3} /> : rows.length === 0 ? (
        <EmptyState title="No hay cuentas para este mes" text="Revisa la empresa seleccionada arriba." />
      ) : (
        <div className="space-y-4">
          {rows.map((r) => (
            <CloseCard key={`${month}-${r.account.id}`} row={r} month={month!} canEdit={can('edit')} entityName={cfg?.entities.find((e) => e.id === r.account.entityId)?.name ?? '—'} onReopen={() => setReopening(r)} />
          ))}
        </div>
      )}

      <Dialog open={!!reopening} onOpenChange={(o) => { if (!o) { setReopening(undefined); setReason('') } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reabrir cierre de {month && formatMonth(month)}</DialogTitle>
            <DialogDescription>{reopening?.account.name}. Podrás editar los movimientos del mes. El motivo queda en el historial.</DialogDescription>
          </DialogHeader>
          <Field label="Motivo (mínimo 10 caracteres)">
            <Input value={reason} autoFocus placeholder="Ej.: falta registrar un pago de nómina" onChange={(e) => setReason(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReopening(undefined)}>Cancelar</Button>
            <Button disabled={busy || reason.trim().length < 10} onClick={reopen}><LockOpen /> Reabrir cierre</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
