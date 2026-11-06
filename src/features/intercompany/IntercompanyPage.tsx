import { useState } from 'react'
import { ArrowRight, HandCoins, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DateInput, DateText, EmptyState, Field, LoadingRows, Money, MoneyInput, PageHeader, Selector } from '@/components/common'
import { openTransaction } from '@/components/panels'
import { useServiceQuery } from '@/hooks/useServiceQuery'
import { useSession } from '@/hooks/useSession'
import { api } from '@/services/api'
import { formatCOP } from '@/lib/format'
import { cn } from '@/lib/utils'

type Pair = { debtor: string; creditor: string }

export default function IntercompanyPage() {
  const { data, loading } = useServiceQuery(() => api.intercompany.matrix(), [])
  const [selected, setSelected] = useState<Pair | null>(null)
  const [repaying, setRepaying] = useState<Pair | 'new' | null>(null)
  const { can } = useSession()
  const name = (id: string) => data?.entities.find((e) => e.id === id)?.name ?? '—'
  // Si no hay celda elegida, se muestra la deuda más grande.
  const current = selected ?? (data?.pairs[0] ? { debtor: data.pairs[0].debtor, creditor: data.pairs[0].creditor } : null)

  return (
    <div>
      <PageHeader
        title="Entre empresas"
        description="Quién le debe a quién. Sale de los movimientos aprobados: cuando una empresa paga algo de otra, queda la deuda. En la vista de grupo estas deudas no aparecen."
        actions={can('approve') && <Button onClick={() => setRepaying('new')}><HandCoins />Registrar devolución</Button>}
      />

      {loading || !data ? <LoadingRows rows={6} /> : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border bg-card p-4">
              <p className="text-sm text-muted-foreground">Deuda interna total</p>
              <p className="mt-1 text-xl font-semibold"><Money value={data.total} /></p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-sm text-muted-foreground">Deudas abiertas</p>
              <p className="num mt-1 text-xl font-semibold">{data.pairs.length}</p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-sm text-muted-foreground">Mayor deuda</p>
              <p className="mt-1 truncate text-sm font-medium">{data.pairs[0] ? `${name(data.pairs[0].debtor)} → ${name(data.pairs[0].creditor)}` : 'Sin deudas'}</p>
              {data.pairs[0] && <Money value={data.pairs[0].value} className="text-lg font-semibold" />}
            </div>
          </div>

          {!data.pairs.length ? <EmptyState title="Las empresas están a paz y salvo" text="No hay deudas entre empresas con los movimientos aprobados." /> : (
            <>
              <section className="rounded-xl border bg-card">
                <header className="border-b px-4 py-3">
                  <h2 className="font-semibold">Quién le debe a quién</h2>
                  <p className="text-xs text-muted-foreground">Cada fila es la empresa que debe; cada columna, a quién le debe. Haz clic en una cifra para ver los movimientos que la forman.</p>
                </header>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead className="bg-muted/50 text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2.5 text-left font-medium">Debe ↓ · Le debe a →</th>
                        {data.entities.map((e) => <th key={e.id} className="px-3 py-2.5 text-right font-medium">{e.name}</th>)}
                        <th className="bg-muted px-3 py-2.5 text-right font-semibold text-foreground">Total que debe</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.entities.map((d) => (
                        <tr key={d.id} className="border-t">
                          <th scope="row" className="px-3 py-2.5 text-left font-medium">{d.name}</th>
                          {data.entities.map((c) => {
                            const v = data.matrix[d.id][c.id]
                            const isSel = current?.debtor === d.id && current?.creditor === c.id
                            return (
                              <td key={c.id} className={cn('px-1.5 py-1 text-right', d.id === c.id && 'bg-muted/40')}>
                                {v > 0 ? (
                                  <button onClick={() => setSelected({ debtor: d.id, creditor: c.id })}
                                    className={cn('w-full rounded-md px-2 py-1.5 text-right font-medium text-amber-800 transition hover:bg-amber-50', isSel && 'bg-amber-100 ring-1 ring-amber-300')}>
                                    <Money value={v} />
                                  </button>
                                ) : <span className="px-2 text-muted-foreground/50">—</span>}
                              </td>
                            )
                          })}
                          <td className="bg-muted/40 px-3 py-2.5 text-right font-semibold"><Money value={data.owes[d.id]} /></td>
                        </tr>
                      ))}
                      <tr className="border-t bg-muted/40">
                        <th scope="row" className="px-3 py-2.5 text-left font-semibold">Total que le deben</th>
                        {data.entities.map((c) => <td key={c.id} className="px-3 py-2.5 text-right font-semibold"><Money value={data.owedTo[c.id]} /></td>)}
                        <td className="px-3 py-2.5 text-right font-semibold"><Money value={data.total} /></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
                <section className="rounded-xl border bg-card">
                  <header className="border-b px-4 py-3"><h2 className="font-semibold">Deudas abiertas</h2></header>
                  <ul className="divide-y">
                    {data.pairs.map((p) => {
                      const isSel = current?.debtor === p.debtor && current?.creditor === p.creditor
                      return (
                        <li key={`${p.debtor}-${p.creditor}`}>
                          <button onClick={() => setSelected(p)} className={cn('flex w-full items-center gap-2 px-4 py-3 text-left text-sm transition hover:bg-muted/50', isSel && 'bg-amber-50')}>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium">{name(p.debtor)} <ArrowRight className="inline size-3.5 text-muted-foreground" /> {name(p.creditor)}</span>
                            </span>
                            <Money value={p.value} className="font-medium text-amber-800" />
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </section>
                {current && <PairDetail pair={current} name={name} canRepay={can('approve')} onRepay={() => setRepaying(current)} />}
              </div>
            </>
          )}
        </div>
      )}

      {repaying && data && (
        <RepaymentDialog
          initial={repaying === 'new' ? current : repaying}
          suggested={(p) => data.matrix[p.debtor]?.[p.creditor] ?? 0}
          onClose={() => setRepaying(null)}
        />
      )}
    </div>
  )
}

function PairDetail({ pair, name, canRepay, onRepay }: { pair: Pair; name: (id: string) => string; canRepay: boolean; onRepay: () => void }) {
  const { data, loading } = useServiceQuery(() => api.intercompany.detail(pair.debtor, pair.creditor), [pair.debtor, pair.creditor])
  return (
    <section className="rounded-xl border bg-card">
      <header className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">{name(pair.debtor)} le debe {data ? formatCOP(data.value) : '…'} a {name(pair.creditor)}</h2>
          <p className="text-xs text-muted-foreground">Movimientos que forman la deuda. Haz clic en uno para ver su detalle y soporte.</p>
        </div>
        {canRepay && data && data.value > 0 && <Button size="sm" variant="outline" onClick={onRepay}><HandCoins />Registrar devolución</Button>}
      </header>
      {loading || !data ? <div className="p-4"><LoadingRows /></div> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr><th className="px-4 py-2 text-left font-medium">Fecha</th><th className="px-4 py-2 text-left font-medium">Movimiento</th><th className="px-4 py-2 text-right font-medium">Efecto en la deuda</th></tr>
            </thead>
            <tbody>
              {data.rows.map((r, i) => (
                <tr key={i} onClick={() => openTransaction(r.transaction.id)} className="cursor-pointer border-t hover:bg-muted/40">
                  <td className="px-4 py-2.5"><DateText iso={r.transaction.date} /></td>
                  <td className="px-4 py-2.5">
                    <p className="truncate">{r.transaction.description}</p>
                    <p className="text-xs text-muted-foreground">{r.effect > 0 ? `${name(r.transaction.payerEntityId)} pagó algo de la otra empresa: aumenta la deuda` : 'Devolución o abono: baja la deuda'}</p>
                  </td>
                  <td className="px-4 py-2.5 text-right"><Money value={r.effect} sign className={r.effect > 0 ? 'text-amber-800' : 'text-emerald-700'} /></td>
                </tr>
              ))}
              <tr className="border-t bg-muted/40 font-semibold">
                <td className="px-4 py-2.5" colSpan={2}>Saldo de la deuda</td>
                <td className="px-4 py-2.5 text-right"><Money value={data.value} /></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function RepaymentDialog({ initial, suggested, onClose }: { initial: Pair | null; suggested: (p: Pair) => number; onClose: () => void }) {
  const { today } = useSession()
  const { data: cfg } = useServiceQuery(() => api.settings.get(), [])
  const [debtor, setDebtor] = useState(initial?.debtor ?? '')
  const [creditor, setCreditor] = useState(initial?.creditor ?? '')
  const [amount, setAmount] = useState<number | undefined>(initial ? suggested(initial) || undefined : undefined)
  const [date, setDate] = useState(today)
  const [source, setSource] = useState('')
  const [destination, setDestination] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)

  const accountsOf = (e: string) => (cfg?.accounts ?? []).filter((a) => a.entityId === e)
  // Si la empresa tiene una sola cuenta, se elige sola.
  const src = source || (accountsOf(debtor).length === 1 ? accountsOf(debtor)[0].id : '')
  const dst = destination || (accountsOf(creditor).length === 1 ? accountsOf(creditor)[0].id : '')
  const debt = debtor && creditor ? suggested({ debtor, creditor }) : 0
  const valid = debtor && creditor && debtor !== creditor && amount && amount > 0 && date && src && dst

  const submit = async () => {
    setBusy(true)
    try {
      const h = await api.intercompany.recordRepayment({ debtor, creditor, amount: amount!, date, sourceAccountId: src, destinationAccountId: dst, description: description.trim() || undefined })
      toast.success('Devolución registrada', { action: { label: 'Ver', onClick: () => openTransaction(h.id) } })
      onClose()
    } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }

  const entityOptions = (cfg?.entities ?? []).map((e) => ({ value: e.id, label: e.name }))
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar devolución</DialogTitle>
          <DialogDescription>Una empresa le devuelve plata a otra. Se registra una sola vez y baja la deuda entre las dos; no es gasto ni ingreso.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quién devuelve"><Selector value={debtor} onChange={(e) => { setDebtor(e.target.value); setSource('') }} options={entityOptions} emptyLabel="(Elegir empresa)" /></Field>
          <Field label="A quién"><Selector value={creditor} onChange={(e) => { setCreditor(e.target.value); setDestination('') }} options={entityOptions.filter((o) => o.value !== debtor)} emptyLabel="(Elegir empresa)" /></Field>
          <Field label="Sale de la cuenta"><Selector value={src} disabled={!debtor} onChange={(e) => setSource(e.target.value)} options={accountsOf(debtor).map((a) => ({ value: a.id, label: a.name }))} emptyLabel="(Elegir cuenta)" /></Field>
          <Field label="Entra a la cuenta"><Selector value={dst} disabled={!creditor} onChange={(e) => setDestination(e.target.value)} options={accountsOf(creditor).map((a) => ({ value: a.id, label: a.name }))} emptyLabel="(Elegir cuenta)" /></Field>
          <Field label="Monto"><MoneyInput value={amount} onChange={setAmount} /></Field>
          <Field label="Fecha"><DateInput value={date} onChange={setDate} /></Field>
          <Field label="Descripción (opcional)" className="col-span-2"><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Devolución de la Empresa A a la Empresa B" /></Field>
        </div>
        {debtor && creditor && debtor !== creditor && (
          <p className={cn('rounded-lg px-3 py-2 text-sm', amount && amount > debt ? 'bg-amber-50 text-amber-900' : 'bg-muted/50 text-muted-foreground')}>
            Deuda actual de {cfg?.entities.find((e) => e.id === debtor)?.name} con {cfg?.entities.find((e) => e.id === creditor)?.name}: <Money value={debt} className="font-medium text-foreground" />.
            {amount && amount > debt ? ' El monto es mayor que la deuda: la diferencia quedará como deuda en sentido contrario.' : ''}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={!valid || busy}>{busy && <Loader2 className="animate-spin" />}Registrar devolución</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
