import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, CheckCircle2, Circle, Loader2 } from 'lucide-react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DateInput, DateText, EmptyState, Field, LoadingRows, Money, MoneyInput, PageHeader, Selector, Tag } from '@/components/common'
import { openTransaction } from '@/components/panels'
import { useServiceQuery } from '@/hooks/useServiceQuery'
import { useSession } from '@/hooks/useSession'
import { api } from '@/services/api'
import { formatCOP, formatDate, formatPct } from '@/lib/format'
import { cn } from '@/lib/utils'

type Detail = Awaited<ReturnType<typeof api.loans.detail>>
type Row = Detail['rows'][number]
type Dlg = { kind: 'pay'; row: Row } | { kind: 'disburse' } | { kind: 'terms' } | { kind: 'bank' } | null

export default function LoanDetailPage() {
  const { id = '' } = useParams()
  const { can } = useSession()
  const { data: d, loading, error } = useServiceQuery(() => api.loans.detail(id), [id])
  const { data: cfg } = useServiceQuery(() => api.settings.get(), [])
  const [dlg, setDlg] = useState<Dlg>(null)

  if (loading) return <LoadingRows rows={8} />
  if (error || !d) return <EmptyState title="No encontramos este crédito" text="Vuelve a la lista de créditos y elige otro." />
  const c = d.loan
  const editable = can('edit')
  const entity = cfg?.entities.find((e) => e.id === c.entityId)?.name ?? '—'

  return (
    <div>
      <Link to="/creditos" className="mb-2 inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Créditos</Link>
      <PageHeader title={c.name} description={`${c.bank} · ${entity}`}
        actions={editable && <>
          <Button size="sm" onClick={() => setDlg({ kind: 'disburse' })} variant="outline">Registrar desembolso</Button>
          <Button size="sm" onClick={() => setDlg({ kind: 'terms' })} variant="outline">Cambiar condiciones</Button>
          <Button size="sm" onClick={() => setDlg({ kind: 'bank' })} variant="outline">Anotar saldo del banco</Button>
        </>} />

      {d.overdue.length > 0 && (
        <div role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>Tienes {d.overdue.length} {d.overdue.length === 1 ? 'cuota vencida' : 'cuotas vencidas'} sin pago registrado (la cuota {d.overdue[0].number} venció el {formatDate(d.overdue[0].date)}). Registra el pago para ponerte al día.</span>
        </div>
      )}

      <section className="mb-4 grid grid-cols-2 gap-3 rounded-xl border bg-card p-4 text-sm md:grid-cols-4">
        <Stat label="Monto"><Money value={c.amount} /></Stat>
        <Stat label="Tasa">{formatPct(c.rate.value, 2)} {c.rate.type} · mensual <span className="num">{formatPct(d.monthlyRate, 4)}</span></Stat>
        <Stat label="Plazo y primera cuota">{c.installmentCount} cuotas · <DateText iso={c.firstDueDate} /></Stat>
        <Stat label="Cuota">
          <Money value={d.totalInstallment} /> <span className="text-muted-foreground">(financiera <Money value={d.baseInstallment} /> + cargos <Money value={c.feesPerInstallment} />)</span>
        </Stat>
        <Stat label="Saldo real"><Money value={d.actualBalance} className="font-semibold" /></Stat>
        <Stat label="Saldo según la tabla"><Money value={d.scheduleBalance} /></Stat>
        <Stat label="Intereses pagados"><Money value={d.interestPaid} /></Stat>
        <Stat label="Cargos pagados"><Money value={d.feesPaid} /></Stat>
        {d.bankBalance && (
          <div className="col-span-2 md:col-span-4">
            <span className="text-xs text-muted-foreground">Saldo que reporta el banco al <DateText iso={d.bankBalance.date} /></span>{' '}
            <Money value={d.bankBalance.balance} />{' '}
            {d.bankDifference === 0 ? <Tag tone="green"><CheckCircle2 />Coincide</Tag> : <Tag tone="amber"><AlertTriangle />Diferencia <Money value={d.bankDifference ?? 0} sign /></Tag>}
            {!!d.bankDifference && <span className="ml-1 text-xs text-muted-foreground">(banco menos saldo real; negativo = el banco reporta menos)</span>}
          </div>
        )}
      </section>

      <section className="mb-4 rounded-xl border bg-card p-4">
        <h2 className="mb-2 text-sm font-semibold">Saldo real frente al saldo según la tabla</h2>
        <div className="h-64 w-full" role="img" aria-label="Gráfica del saldo real y el saldo según la tabla de amortización">
          <ResponsiveContainer>
            <LineChart data={d.series} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tickFormatter={(v: string) => formatDate(v).slice(3)} fontSize={11} minTickGap={24} />
              <YAxis tickFormatter={(v: number) => `${Math.round(v / 1e6)} M`} fontSize={11} width={44} />
              <Tooltip formatter={(v) => formatCOP(Number(v))} labelFormatter={(v) => formatDate(String(v))} />
              <Legend />
              <Line type="monotone" dataKey="table" name="Según la tabla" stroke="#64748b" strokeDasharray="5 4" dot={false} />
              <Line type="monotone" dataKey="real" name="Saldo real" stroke="#0d9488" strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border bg-card">
        <h2 className="border-b px-4 py-3 text-sm font-semibold">Tabla de amortización</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">N.º</th>
                <th className="px-3 py-2 text-left font-medium">Fecha</th>
                <th className="px-3 py-2 text-right font-medium">Capital</th>
                <th className="px-3 py-2 text-right font-medium">Interés</th>
                <th className="px-3 py-2 text-right font-medium">Cargos</th>
                <th className="px-3 py-2 text-right font-medium">Cuota</th>
                <th className="px-3 py-2 text-right font-medium">Saldo</th>
                <th className="px-3 py-2 text-left font-medium">Estado</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {d.rows.map((r) => (
                <tr key={r.number} className={cn('border-t', r.status === 'overdue' && 'bg-red-50/70')}>
                  <td className="num px-3 py-2">{r.number}</td>
                  <td className="px-3 py-2"><DateText iso={r.date} /></td>
                  <td className="px-3 py-2 text-right"><Money value={r.capital} /></td>
                  <td className="px-3 py-2 text-right"><Money value={r.interest} /></td>
                  <td className="px-3 py-2 text-right"><Money value={r.fees} /></td>
                  <td className="px-3 py-2 text-right"><Money value={r.total} /></td>
                  <td className="px-3 py-2 text-right"><Money value={r.balance} /></td>
                  <td className="px-3 py-2">
                    {r.status === 'paid' ? <Tag tone="green"><CheckCircle2 />Pagada</Tag>
                      : r.status === 'overdue' ? <Tag tone="red"><AlertTriangle />Vencida</Tag>
                      : <Tag><Circle />Futura</Tag>}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {r.status === 'paid' && r.transactionId && <Button size="xs" variant="ghost" onClick={() => openTransaction(r.transactionId!)}>Ver pago</Button>}
                    {r.status !== 'paid' && editable && <Button size="xs" variant={r.status === 'overdue' ? 'default' : 'outline'} onClick={() => setDlg({ kind: 'pay', row: r })}>Registrar pago</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {dlg?.kind === 'pay' && <PayDialog detail={d} row={dlg.row} onClose={() => setDlg(null)} />}
      {dlg?.kind === 'disburse' && <DisburseDialog detail={d} onClose={() => setDlg(null)} />}
      {dlg?.kind === 'terms' && <TermsDialog detail={d} onClose={() => setDlg(null)} />}
      {dlg?.kind === 'bank' && <BankDialog detail={d} onClose={() => setDlg(null)} />}
    </div>
  )
}

const Stat = ({ label, children }: { label: string; children: ReactNode }) => (
  <div><div className="text-xs text-muted-foreground">{label}</div><div>{children}</div></div>
)

/** Estructura común de los diálogos: título, campos, y botones con estado de envío y aviso. */
function ActionDialog({ title, description, submitLabel, valid, onSubmit, onClose, children }: {
  title: string; description: string; submitLabel: string; valid: boolean; onSubmit: () => Promise<string>; onClose: () => void; children: ReactNode
}) {
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    setBusy(true)
    try { toast.success(await onSubmit()); onClose() } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
        <div className="grid grid-cols-2 gap-3">{children}</div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={!valid || busy} onClick={submit}>{busy && <Loader2 className="animate-spin" />}{submitLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Cuentas de la empresa dueña del crédito, con la del crédito preseleccionada. */
function useAccounts(c: Detail['loan']) {
  const { data: cfg } = useServiceQuery(() => api.settings.get(), [])
  const options = (cfg?.accounts ?? []).filter((a) => a.entityId === c.entityId).map((a) => ({ value: a.id, label: a.name }))
  return { options, initial: c.accountId ?? '' }
}

function PayDialog({ detail, row, onClose }: { detail: Detail; row: Row; onClose: () => void }) {
  const c = detail.loan
  const { today } = useSession()
  const acc = useAccounts(c)
  const [account, setAccount] = useState(acc.initial)
  const [date, setDate] = useState(today)
  const [capital, setCapital] = useState<number | undefined>(row.capital)
  const [interest, setInterest] = useState<number | undefined>(row.interest)
  const [fees, setFees] = useState<number | undefined>(row.fees)
  const total = (capital ?? 0) + (interest ?? 0) + (fees ?? 0)
  return (
    <ActionDialog title={`Registrar pago de la cuota ${row.number}`} description="El desglose viene de la tabla de amortización; ajústalo si el banco cobró algo distinto." submitLabel="Registrar pago"
      valid={!!account && !!date && total > 0} onClose={onClose}
      onSubmit={async () => { await api.loans.recordPayment(c.id, { installmentNumber: row.number, date, capital: capital ?? 0, interest: interest ?? 0, fees: fees ?? 0, accountId: account }); return `Pago de la cuota ${row.number} registrado` }}>
      <Field label="Capital"><MoneyInput value={capital} onChange={setCapital} /></Field>
      <Field label="Interés"><MoneyInput value={interest} onChange={setInterest} /></Field>
      <Field label="Cargos"><MoneyInput value={fees} onChange={setFees} /></Field>
      <Field label="Total a pagar"><div className="flex h-8 items-center justify-end font-semibold"><Money value={total} /></div></Field>
      <Field label="Sale de la cuenta"><Selector value={account} onChange={(e) => setAccount(e.target.value)} options={acc.options} emptyLabel="(Elegir cuenta)" /></Field>
      <Field label="Fecha de pago"><DateInput value={date} onChange={setDate} /></Field>
    </ActionDialog>
  )
}

function DisburseDialog({ detail, onClose }: { detail: Detail; onClose: () => void }) {
  const c = detail.loan
  const { today } = useSession()
  const acc = useAccounts(c)
  const [account, setAccount] = useState(acc.initial)
  const [date, setDate] = useState(today)
  const [amount, setAmount] = useState<number | undefined>()
  return (
    <ActionDialog title="Registrar desembolso" description="Entra plata a la cuenta y sube la deuda. No cuenta como ingreso." submitLabel="Registrar desembolso"
      valid={!!account && !!amount && !!date} onClose={onClose}
      onSubmit={async () => { await api.loans.recordDisbursement(c.id, { date, amount: amount!, accountId: account }); return 'Desembolso registrado' }}>
      <Field label="Monto"><MoneyInput value={amount} onChange={setAmount} /></Field>
      <Field label="Fecha"><DateInput value={date} onChange={setDate} /></Field>
      <Field label="Entra a la cuenta" className="col-span-2"><Selector value={account} onChange={(e) => setAccount(e.target.value)} options={acc.options} emptyLabel="(Elegir cuenta)" /></Field>
    </ActionDialog>
  )
}

function TermsDialog({ detail, onClose }: { detail: Detail; onClose: () => void }) {
  const c = detail.loan
  const { today } = useSession()
  const acc = useAccounts(c)
  const [type, setType] = useState<'rate' | 'extra_payment'>('rate')
  const [rate, setRate] = useState('')
  const [extra, setExtra] = useState<number | undefined>()
  const [date, setDate] = useState(today)
  const [account, setAccount] = useState(acc.initial)
  const [note, setNote] = useState('')
  // La tasa se escribe en % (ej. 13,5) y el servicio la recibe como fracción.
  const rateValue = Number(rate.replace(',', '.')) / 100
  const valid = !!date && (type === 'rate' ? rateValue > 0 : !!extra && !!account)
  return (
    <ActionDialog title="Cambiar condiciones" description="La tabla se recalcula desde la primera cuota con fecha igual o posterior al cambio, manteniendo el plazo." submitLabel="Aplicar cambio"
      valid={valid} onClose={onClose}
      onSubmit={async () => { await api.loans.changeTerms(c.id, { type, value: type === 'rate' ? rateValue : extra!, date, note, accountId: type === 'extra_payment' ? account : undefined }); return 'Condiciones actualizadas; la tabla se recalculó' }}>
      <Field label="Qué cambia" className="col-span-2">
        <Selector value={type} onChange={(e) => setType(e.target.value as 'rate' | 'extra_payment')} options={[{ value: 'rate', label: `Tasa (${c.rate.type})` }, { value: 'extra_payment', label: 'Abono extra a capital' }]} />
      </Field>
      {type === 'rate'
        ? <Field label={`Nueva tasa ${c.rate.type} (%)`}><Input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="13,5" /></Field>
        : <Field label="Monto del abono"><MoneyInput value={extra} onChange={setExtra} /></Field>}
      <Field label="Desde la fecha"><DateInput value={date} onChange={setDate} /></Field>
      {type === 'extra_payment' && <Field label="Sale de la cuenta" className="col-span-2"><Selector value={account} onChange={(e) => setAccount(e.target.value)} options={acc.options} emptyLabel="(Elegir cuenta)" /></Field>}
      <Field label="Nota (opcional)" className="col-span-2"><Input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
    </ActionDialog>
  )
}

function BankDialog({ detail, onClose }: { detail: Detail; onClose: () => void }) {
  const { today } = useSession()
  const [date, setDate] = useState(today)
  const [balance, setBalance] = useState<number | undefined>()
  return (
    <ActionDialog title="Anotar saldo del banco" description="Anota el saldo que dice el extracto del banco para compararlo con el saldo real." submitLabel="Guardar saldo"
      valid={balance !== undefined && !!date} onClose={onClose}
      onSubmit={async () => { await api.loans.recordBankBalance(detail.loan.id, { date, balance: balance! }); return 'Saldo del banco anotado' }}>
      <Field label="Saldo del banco"><MoneyInput value={balance} onChange={setBalance} /></Field>
      <Field label="Fecha del extracto"><DateInput value={date} onChange={setDate} /></Field>
    </ActionDialog>
  )
}
