// Agenda: obligaciones recurrentes y cuotas en lista o calendario mensual, y tareas (contexto §10).
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, parseISO, startOfWeek } from 'date-fns'
import { AlertTriangle, CalendarCheck, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock, List, ListChecks, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DateInput, DateText, EmptyState, Field, LoadingRows, Money, MoneyInput, PageHeader, Selector, Tag } from '@/components/common'
import { useServiceQuery } from '@/hooks/useServiceQuery'
import { useSession } from '@/hooks/useSession'
import { api } from '@/services/api'
import { formatMonth } from '@/lib/format'
import { cn } from '@/lib/utils'

type Status = 'fulfilled' | 'overdue' | 'pending'
type Item = {
  key: string; date: string; title: string; entityId: string; amount: number; status: Status
  assignee: string; kind: 'obligation' | 'installment'; obligationId?: string; loanId?: string
}

const STATUS = {
  fulfilled: { label: 'Cumplida', tone: 'green', icon: CheckCircle2, dot: 'bg-emerald-500' },
  overdue: { label: 'Vencida', tone: 'red', icon: AlertTriangle, dot: 'bg-red-500' },
  pending: { label: 'Pendiente', tone: 'amber', icon: Clock, dot: 'bg-amber-500' },
} as const

const errorText = (e: unknown) => (e instanceof Error ? e.message : 'No se pudo completar la acción. Intenta de nuevo.')
const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const StatusTag = ({ status }: { status: Status }) => {
  const s = STATUS[status]
  return <Tag tone={s.tone}><s.icon /> {s.label}</Tag>
}

export default function AgendaPage() {
  const { today, can } = useSession()
  const [month, setMonth] = useState(today.slice(0, 7))
  const [view, setView] = useState<'list' | 'calendar' | 'tasks'>('list')
  const [selectedDay, setSelectedDay] = useState(today)
  const [paying, setPaying] = useState<Item>()
  const [newTask, setNewTask] = useState(false)

  const from = `${month}-01`
  const to = format(endOfMonth(parseISO(from)), 'yyyy-MM-dd')
  const { data: items, loading } = useServiceQuery(async () => {
    const [occ, loanList] = await Promise.all([api.agenda.occurrences(from, to), api.loans.list()])
    const details = await Promise.all(loanList.map((l) => api.loans.detail(l.loan.id)))
    const out: Item[] = occ.map((o) => ({
      key: `${o.obligation.id}-${o.date}`, date: o.date, title: o.obligation.name, entityId: o.obligation.entityId, amount: o.obligation.value,
      status: o.status, assignee: o.assignee, kind: 'obligation', obligationId: o.obligation.id,
    }))
    for (const d of details) for (const f of d.rows) if (f.date >= from && f.date <= to) out.push({
      key: `${d.loan.id}-${f.number}`, date: f.date, title: `Cuota ${f.number} · ${d.loan.name}`, entityId: d.loan.entityId, amount: f.total,
      status: f.status === 'paid' ? 'fulfilled' : f.status === 'overdue' ? 'overdue' : 'pending', assignee: '—', kind: 'installment', loanId: d.loan.id,
    })
    return out.sort((a, b) => a.date.localeCompare(b.date))
  }, [month])
  const { data: tasks } = useServiceQuery(() => api.agenda.tasks(), [])
  const { data: cfg } = useServiceQuery(() => api.settings.get(), [])
  const entityName = (id: string) => cfg?.entities.find((e) => e.id === id)?.name ?? '—'

  const row = (i: Item) => (
    <li key={i.key} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium">{i.title}</p>
        <p className="text-xs text-muted-foreground"><DateText iso={i.date} /> · {entityName(i.entityId)} · Responsable: {i.assignee}</p>
      </div>
      <div className="flex items-center gap-2">
        <Money value={i.amount} className="text-sm" />
        <StatusTag status={i.status} />
        {i.status !== 'fulfilled' && (i.kind === 'obligation'
          ? <Button size="sm" variant="outline" disabled={!can('upload')} onClick={() => setPaying(i)}>Registrar pago</Button>
          : <Button size="sm" variant="outline" nativeButton={false} render={<Link to={`/creditos/${i.loanId}`} />}>Ir al crédito</Button>)}
      </div>
    </li>
  )

  // Cuadrícula del mes (lunes a domingo); solo es presentación.
  const days = eachDayOfInterval({ start: startOfWeek(parseISO(from), { weekStartsOn: 1 }), end: endOfWeek(parseISO(to), { weekStartsOn: 1 }) })
  const byDay = (d: string) => (items ?? []).filter((i) => i.date === d)

  return (
    <div>
      <PageHeader
        title="Agenda"
        description="Arriendos, IVA, nómina, servicios y cuotas de créditos, con su responsable."
        actions={<Tag tone="blue"><CalendarCheck /> Sincronizado con Google Calendar</Tag>}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon-sm" aria-label="Mes anterior" onClick={() => setMonth(format(addMonths(parseISO(from), -1), 'yyyy-MM'))}><ChevronLeft /></Button>
          <span className="min-w-36 text-center text-sm font-medium capitalize">{formatMonth(month)}</span>
          <Button variant="outline" size="icon-sm" aria-label="Mes siguiente" onClick={() => setMonth(format(addMonths(parseISO(from), 1), 'yyyy-MM'))}><ChevronRight /></Button>
        </div>
        <div className="flex gap-1" role="group" aria-label="Vista">
          <Button size="sm" aria-pressed={view === 'list'} variant={view === 'list' ? 'default' : 'outline'} onClick={() => setView('list')}><List /> Lista</Button>
          <Button size="sm" aria-pressed={view === 'calendar'} variant={view === 'calendar' ? 'default' : 'outline'} onClick={() => setView('calendar')}><CalendarDays /> Calendario</Button>
          <Button size="sm" aria-pressed={view === 'tasks'} variant={view === 'tasks' ? 'default' : 'outline'} onClick={() => setView('tasks')}><ListChecks /> Tareas</Button>
        </div>
      </div>

      {view === 'tasks' ? null : loading || !items ? <LoadingRows rows={5} /> : items.length === 0 ? (
        <EmptyState title="Nada programado este mes" text="Cambia de mes para ver otras obligaciones." />
      ) : view === 'list' ? (
        <ul className="divide-y rounded-xl border bg-card px-4">{items.map(row)}</ul>
      ) : (
        <div>
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border bg-border text-center">
            {WEEKDAYS.map((w) => <div key={w} className="bg-muted py-1 text-xs font-medium text-muted-foreground">{w}</div>)}
            {days.map((d) => {
              const key = format(d, 'yyyy-MM-dd'); const list = byDay(key); const inMonth = key.startsWith(month)
              return (
                <button key={key} type="button" onClick={() => setSelectedDay(key)} aria-label={`${key.slice(8)} con ${list.length} pendientes o cumplidas`}
                  className={cn('flex min-h-14 flex-col items-center gap-1 bg-card p-1 text-xs hover:bg-muted/50 sm:min-h-20', !inMonth && 'bg-muted/30 text-muted-foreground', key === today && 'font-bold text-sky-700', key === selectedDay && 'ring-2 ring-inset ring-ring')}>
                  <span>{key.slice(8)}</span>
                  <span className="flex flex-wrap justify-center gap-0.5">
                    {list.map((i) => <span key={i.key} className={cn('size-2 rounded-full', STATUS[i.status].dot)} />)}
                  </span>
                </button>
              )
            })}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Verde: cumplida · Rojo: vencida · Ámbar: pendiente</p>
          <h2 className="mt-4 mb-1 text-sm font-medium">Día <DateText iso={selectedDay} /></h2>
          {byDay(selectedDay).length === 0 ? <p className="text-sm text-muted-foreground">No hay vencimientos este día.</p> : <ul className="divide-y rounded-xl border bg-card px-4">{byDay(selectedDay).map(row)}</ul>}
        </div>
      )}

      {view === 'tasks' && <section className="mt-2">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Tareas</h2>
          <Button size="sm" disabled={!can('upload')} onClick={() => setNewTask(true)}><Plus /> Agregar tarea</Button>
        </div>
        {!tasks ? <LoadingRows rows={3} /> : tasks.length === 0 ? <EmptyState title="Sin tareas" text="Crea una con el botón “Agregar tarea”." /> : (
          <ul className="divide-y rounded-xl border bg-card px-4">
            {tasks.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-2.5">
                <input type="checkbox" className="size-5 accent-primary" checked={t.done} disabled={!can('upload')} aria-label={`Marcar como hecha: ${t.title}`}
                  onChange={(e) => api.agenda.setTaskDone(t.id, e.target.checked).catch((err) => toast.error(errorText(err)))} />
                <div className={cn('min-w-0 flex-1', t.done && 'text-muted-foreground line-through')}>
                  <p className="text-sm font-medium">{t.title}</p>
                  <p className="text-xs">Vence <DateText iso={t.due} />{t.entityId ? ` · ${entityName(t.entityId)}` : ''}</p>
                </div>
                {t.done ? <Tag tone="green"><CheckCircle2 /> Hecha</Tag> : t.due < today ? <Tag tone="red"><AlertTriangle /> Vencida</Tag> : <Tag tone="amber"><Clock /> Pendiente</Tag>}
              </li>
            ))}
          </ul>
        )}
      </section>}

      {paying && cfg && <PayDialog item={paying} accounts={cfg.accounts.filter((c) => c.entityId === paying.entityId)} onClose={() => setPaying(undefined)} />}
      {newTask && cfg && <TaskDialog entities={cfg.entities} today={today} onClose={() => setNewTask(false)} />}
    </div>
  )
}

function PayDialog({ item, accounts, onClose }: { item: Item; accounts: { id: string; name: string; bank: string }[]; onClose: () => void }) {
  const { today } = useSession()
  const [date, setDate] = useState(today)
  const [amount, setAmount] = useState<number | undefined>(item.amount)
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    setBusy(true)
    try { await api.agenda.recordPayment(item.obligationId!, item.date, { date, amount: amount!, accountId }); toast.success('Pago registrado: la obligación quedó cumplida'); onClose() }
    catch (e) { toast.error(errorText(e)) } finally { setBusy(false) }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar pago</DialogTitle>
          <DialogDescription>{item.title} · vence el <DateText iso={item.date} />. Se crea el movimiento y la obligación queda cumplida.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Fecha de pago"><DateInput value={date} onChange={setDate} /></Field>
          <Field label="Valor pagado"><MoneyInput value={amount} onChange={setAmount} /></Field>
          <Field label="Cuenta de donde sale">
            <Selector value={accountId} onChange={(e) => setAccountId(e.target.value)} options={accounts.map((c) => ({ value: c.id, label: `${c.name} · ${c.bank}` }))} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={busy || !amount || !accountId} onClick={submit}>Registrar pago</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TaskDialog({ entities, today, onClose }: { entities: { id: string; name: string }[]; today: string; onClose: () => void }) {
  const [title, setTitle] = useState('')
  const [due, setDue] = useState(today)
  const [entityId, setEntityId] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    setBusy(true)
    try { await api.agenda.createTask({ title: title.trim(), due, entityId: entityId || undefined }); toast.success('Tarea creada'); onClose() }
    catch (e) { toast.error(errorText(e)) } finally { setBusy(false) }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nueva tarea</DialogTitle><DialogDescription>Aparece en la agenda y en las alertas cuando se acerca la fecha.</DialogDescription></DialogHeader>
        <div className="grid gap-3">
          <Field label="¿Qué hay que hacer?"><Input value={title} autoFocus onChange={(e) => setTitle(e.target.value)} /></Field>
          <Field label="Vence"><DateInput value={due} onChange={setDue} /></Field>
          <Field label="Empresa (opcional)"><Selector value={entityId} onChange={(e) => setEntityId(e.target.value)} emptyLabel="Ninguna" options={entities.map((e) => ({ value: e.id, label: e.name }))} /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={busy || title.trim().length < 3 || due.length !== 10} onClick={submit}>Crear tarea</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
