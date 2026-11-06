import { Link, useNavigate } from 'react-router-dom'
import { AlarmClock, AlertCircle, AlertTriangle, CalendarClock, ChevronRight, Inbox, Landmark, TrendingUp, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Uploader } from '@/components/Uploader'
import { CashBasisNote, LoadingRows, Tag, DateText, Money, EmptyState } from '@/components/common'
import { Figure } from '@/components/panels'
import { ConnectedChannels } from '@/features/inbox/InboxPage'
import { useServiceQuery } from '@/hooks/useServiceQuery'
import { useSession } from '@/hooks/useSession'
import { api } from '@/services/api'
import { formatDate, formatMonth } from '@/lib/format'
import { cn } from '@/lib/utils'

function StatCard({ title, icon, children, footer, tone }: { title: string; icon: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode; tone?: 'amber' | 'red' }) {
  return (
    <div className={cn('flex flex-col rounded-xl border bg-card p-4 shadow-xs', tone === 'red' && 'border-red-200', tone === 'amber' && 'border-amber-200')}>
      <div className="flex items-center justify-between text-sm text-muted-foreground"><span>{title}</span><span className="[&_svg]:size-4">{icon}</span></div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{children}</div>
      {footer && <div className="mt-auto pt-2 text-xs text-muted-foreground">{footer}</div>}
    </div>
  )
}

export default function HomePage() {
  const { user, today } = useSession()
  const { data: r } = useServiceQuery(() => api.home.summary(), [])
  const { data: alerts, loading: loadingAlerts } = useServiceQuery(() => api.home.alerts(), [])
  const { data: dueSoon } = useServiceQuery(() => api.home.dueItems(30), [])
  const navigate = useNavigate()
  const snooze = async (id: string, days: number) => { await api.home.snooze(id, days); toast.success(`Alerta pospuesta ${days === 7 ? '1 semana' : days === 1 ? '1 día' : `${days} días`}`) }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{formatDate(today)}</p>
          <h1 className="text-2xl font-semibold tracking-tight">Hola, {user?.name.split(' ')[0]}. ¿Qué pasó?</h1>
        </div>
        <div className="hidden sm:block"><ConnectedChannels /></div>
      </div>

      <Uploader large />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard title="Plata disponible del grupo" icon={<Wallet />} footer={<span className="flex items-center gap-2">Hoy, sin asuntos personales <CashBasisNote /></span>}>
          {r ? <Figure value={r.cash.value} lines={r.cash.lines} title="Plata disponible del grupo" /> : <span className="block h-8 w-32 animate-pulse rounded bg-muted" />}
        </StatCard>
        <StatCard title={`Resultado de ${r ? formatMonth(r.month) : 'el mes'}`} icon={<TrendingUp />} footer={r?.monthResult.pendingApproval ? <span className="text-amber-700">{r.monthResult.pendingApproval} por aprobar</span> : <CashBasisNote />}>
          {r ? <Figure value={r.monthResult.value} lines={r.monthResult.lines} title="Resultado del mes (grupo)" color /> : <span className="block h-8 w-32 animate-pulse rounded bg-muted" />}
        </StatCard>
        <StatCard title="Por revisar" icon={<Inbox />} tone={r?.pending ? 'amber' : undefined} footer={<Link to="/bandeja" className="text-primary hover:underline">{r?.pendingItems ?? 0} elementos en la bandeja →</Link>}>
          <span className="num">{r?.pending ?? '–'}</span> <span className="text-sm font-normal text-muted-foreground">propuestas</span>
        </StatCard>
        <StatCard title="Alertas" icon={<AlertCircle />} tone={r?.redAlerts ? 'red' : undefined} footer={r?.redAlerts ? <span className="text-red-700">{r.redAlerts} vencidas</span> : 'Nada vencido'}>
          <span className="num">{r?.alerts ?? '–'}</span>
        </StatCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <section className="rounded-xl border bg-card">
          <header className="flex items-center justify-between border-b px-4 py-3"><h2 className="font-semibold">Alertas</h2><span className="text-xs text-muted-foreground">{alerts?.length ?? 0} activas</span></header>
          {loadingAlerts ? <div className="p-4"><LoadingRows /></div> : !alerts?.length ? <div className="p-4"><EmptyState title="Sin alertas" text="Todo está al día." /></div> : (
            <ul className="divide-y">
              {alerts.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                  {a.level === 'red' ? <AlertCircle className="size-5 shrink-0 text-red-600" /> : <AlertTriangle className="size-5 shrink-0 text-amber-500" />}
                  <button className="min-w-0 flex-1 text-left" onClick={() => navigate(a.link)}>
                    <p className={cn('truncate text-sm font-medium', a.level === 'red' && 'text-red-700')}>{a.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{a.detail}</p>
                  </button>
                  {a.amount ? <Money value={a.amount} className="hidden text-sm sm:inline" /> : null}
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}><AlarmClock /><span className="hidden sm:inline">Posponer</span></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => snooze(a.id, 1)}>1 día</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => snooze(a.id, 3)}>3 días</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => snooze(a.id, 7)}>1 semana</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border bg-card">
          <header className="flex items-center justify-between border-b px-4 py-3"><h2 className="font-semibold">Vence en los próximos 30 días</h2><Link to="/agenda" className="text-xs text-primary hover:underline">Agenda</Link></header>
          {!dueSoon ? <div className="p-4"><LoadingRows /></div> : !dueSoon.length ? <div className="p-4"><EmptyState title="Nada por vencer" /></div> : (
            <ul className="divide-y">
              {dueSoon.slice(0, 12).map((v, i) => (
                <li key={i}>
                  <Link to={v.link} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40">
                    <div className="w-12 shrink-0 text-center"><p className="num text-lg leading-none font-semibold">{v.date.slice(8)}</p><p className="text-[10px] text-muted-foreground uppercase">{formatMonth(v.date.slice(0, 7), true)}</p></div>
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{v.title}</p><p className="truncate text-xs text-muted-foreground">{v.detail}</p></div>
                    {v.type === 'installment' ? <Tag tone="blue"><Landmark />Cuota</Tag> : v.type === 'task' ? <Tag><CalendarClock />Tarea</Tag> : null}
                    {v.amount ? <Money value={v.amount} className="text-sm" /> : null}
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {dueSoon && dueSoon.length > 12 && <p className="border-t px-4 py-2 text-xs text-muted-foreground">y {dueSoon.length - 12} más · <DateText iso={dueSoon.at(-1)!.date} /></p>}
        </section>
      </div>
    </div>
  )
}
