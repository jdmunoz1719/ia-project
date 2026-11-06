import { Link, useNavigate } from 'react-router-dom'
import { AlarmClock, AlertCircle, AlertTriangle, CalendarClock, ChevronRight, Inbox, Landmark, TrendingUp, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Cargador } from '@/components/Cargador'
import { BaseCaja, Cargando, Etiqueta, Fecha, Money, Vacio } from '@/components/comunes'
import { Cifra } from '@/components/paneles'
import { Conectados } from '@/features/bandeja/Bandeja'
import { useConsulta } from '@/hooks/useConsulta'
import { useSesion } from '@/hooks/useSesion'
import { api } from '@/services/api'
import { formatFecha, formatMes } from '@/lib/format'
import { cn } from '@/lib/utils'

function Tarjeta({ titulo, icono, children, pie, tono }: { titulo: string; icono: React.ReactNode; children: React.ReactNode; pie?: React.ReactNode; tono?: 'ambar' | 'rojo' }) {
  return (
    <div className={cn('flex flex-col rounded-xl border bg-card p-4 shadow-xs', tono === 'rojo' && 'border-red-200', tono === 'ambar' && 'border-amber-200')}>
      <div className="flex items-center justify-between text-sm text-muted-foreground"><span>{titulo}</span><span className="[&_svg]:size-4">{icono}</span></div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{children}</div>
      {pie && <div className="mt-auto pt-2 text-xs text-muted-foreground">{pie}</div>}
    </div>
  )
}

export default function Inicio() {
  const { usuario, hoy } = useSesion()
  const { data: r } = useConsulta(() => api.inicio.resumen(), [])
  const { data: alertas, cargando: cargandoAlertas } = useConsulta(() => api.inicio.alertas(), [])
  const { data: venc } = useConsulta(() => api.inicio.vencimientos(30), [])
  const navigate = useNavigate()
  const posponer = async (id: string, dias: number) => { await api.inicio.posponer(id, dias); toast.success(`Alerta pospuesta ${dias === 7 ? '1 semana' : dias === 1 ? '1 día' : `${dias} días`}`) }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{formatFecha(hoy)}</p>
          <h1 className="text-2xl font-semibold tracking-tight">Hola, {usuario?.nombre.split(' ')[0]}. ¿Qué pasó?</h1>
        </div>
        <div className="hidden sm:block"><Conectados /></div>
      </div>

      <Cargador grande />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tarjeta titulo="Plata disponible del grupo" icono={<Wallet />} pie={<span className="flex items-center gap-2">Hoy, sin asuntos personales <BaseCaja /></span>}>
          {r ? <Cifra valor={r.plata.valor} lineas={r.plata.lineas} titulo="Plata disponible del grupo" /> : <span className="block h-8 w-32 animate-pulse rounded bg-muted" />}
        </Tarjeta>
        <Tarjeta titulo={`Resultado de ${r ? formatMes(r.mes) : 'el mes'}`} icono={<TrendingUp />} pie={r?.resultadoMes.pendientesPorAprobar ? <span className="text-amber-700">{r.resultadoMes.pendientesPorAprobar} por aprobar</span> : <BaseCaja />}>
          {r ? <Cifra valor={r.resultadoMes.valor} lineas={r.resultadoMes.lineas} titulo="Resultado del mes (grupo)" color /> : <span className="block h-8 w-32 animate-pulse rounded bg-muted" />}
        </Tarjeta>
        <Tarjeta titulo="Por revisar" icono={<Inbox />} tono={r?.pendientes ? 'ambar' : undefined} pie={<Link to="/bandeja" className="text-primary hover:underline">{r?.itemsPendientes ?? 0} elementos en la bandeja →</Link>}>
          <span className="num">{r?.pendientes ?? '–'}</span> <span className="text-sm font-normal text-muted-foreground">propuestas</span>
        </Tarjeta>
        <Tarjeta titulo="Alertas" icono={<AlertCircle />} tono={r?.alertasRojas ? 'rojo' : undefined} pie={r?.alertasRojas ? <span className="text-red-700">{r.alertasRojas} vencidas</span> : 'Nada vencido'}>
          <span className="num">{r?.alertas ?? '–'}</span>
        </Tarjeta>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <section className="rounded-xl border bg-card">
          <header className="flex items-center justify-between border-b px-4 py-3"><h2 className="font-semibold">Alertas</h2><span className="text-xs text-muted-foreground">{alertas?.length ?? 0} activas</span></header>
          {cargandoAlertas ? <div className="p-4"><Cargando /></div> : !alertas?.length ? <div className="p-4"><Vacio titulo="Sin alertas" texto="Todo está al día." /></div> : (
            <ul className="divide-y">
              {alertas.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                  {a.nivel === 'rojo' ? <AlertCircle className="size-5 shrink-0 text-red-600" /> : <AlertTriangle className="size-5 shrink-0 text-amber-500" />}
                  <button className="min-w-0 flex-1 text-left" onClick={() => navigate(a.enlace)}>
                    <p className={cn('truncate text-sm font-medium', a.nivel === 'rojo' && 'text-red-700')}>{a.titulo}</p>
                    <p className="truncate text-xs text-muted-foreground">{a.detalle}</p>
                  </button>
                  {a.monto ? <Money valor={a.monto} className="hidden text-sm sm:inline" /> : null}
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}><AlarmClock /><span className="hidden sm:inline">Posponer</span></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => posponer(a.id, 1)}>1 día</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => posponer(a.id, 3)}>3 días</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => posponer(a.id, 7)}>1 semana</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border bg-card">
          <header className="flex items-center justify-between border-b px-4 py-3"><h2 className="font-semibold">Vence en los próximos 30 días</h2><Link to="/agenda" className="text-xs text-primary hover:underline">Agenda</Link></header>
          {!venc ? <div className="p-4"><Cargando /></div> : !venc.length ? <div className="p-4"><Vacio titulo="Nada por vencer" /></div> : (
            <ul className="divide-y">
              {venc.slice(0, 12).map((v, i) => (
                <li key={i}>
                  <Link to={v.enlace} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40">
                    <div className="w-12 shrink-0 text-center"><p className="num text-lg leading-none font-semibold">{v.fecha.slice(8)}</p><p className="text-[10px] text-muted-foreground uppercase">{formatMes(v.fecha.slice(0, 7), true)}</p></div>
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{v.titulo}</p><p className="truncate text-xs text-muted-foreground">{v.detalle}</p></div>
                    {v.tipo === 'cuota' ? <Etiqueta tono="azul"><Landmark />Cuota</Etiqueta> : v.tipo === 'tarea' ? <Etiqueta><CalendarClock />Tarea</Etiqueta> : null}
                    {v.monto ? <Money valor={v.monto} className="text-sm" /> : null}
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {venc && venc.length > 12 && <p className="border-t px-4 py-2 text-xs text-muted-foreground">y {venc.length - 12} más · <Fecha iso={venc.at(-1)!.fecha} /></p>}
        </section>
      </div>
    </div>
  )
}
