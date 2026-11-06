import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  ArrowLeftRight, BarChart3, BookOpen, CalendarDays, ChevronDown, FileBarChart, Home, Inbox, Landmark, ListOrdered,
  LockKeyhole, LogOut, Menu, MessageSquare, RotateCcw, Settings, UserRound,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Selector } from '@/components/common'
import { GlobalPanels } from '@/components/panels'
import { useServiceQuery } from '@/hooks/useServiceQuery'
import { useSession } from '@/hooks/useSession'
import { api, DEMO_USERS } from '@/services/api'
import { useUI } from '@/store/ui'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Role } from '@/domain/types'

export const APP_NAME = 'Caja Clara'
const NAV = [
  { to: '/', label: 'Inicio', icon: Home },
  { to: '/bandeja', label: 'Bandeja', icon: Inbox, hidden: (r: Role) => r === 'accountant' },
  { to: '/movimientos', label: 'Movimientos', icon: ListOrdered },
  { to: '/entre-empresas', label: 'Entre empresas', icon: ArrowLeftRight },
  { to: '/tableros', label: 'Tableros', icon: BarChart3 },
  { to: '/creditos', label: 'Créditos', icon: Landmark },
  { to: '/cierres', label: 'Cierres', icon: LockKeyhole },
  { to: '/agenda', label: 'Agenda', icon: CalendarDays },
  { to: '/chat', label: 'Chat', icon: MessageSquare },
  { to: '/informes', label: 'Informes', icon: FileBarChart },
  { to: '/configuracion', label: 'Configuración', icon: Settings },
]
const ROLE_NAMES: Record<Role, string> = { admin: 'Administrador', assistant: 'Asistente', accountant: 'Contador' }

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm">
        <svg viewBox="0 0 32 32" className="size-5"><path d="M7 21.5 13.5 15l4 4L25 11" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </div>
      <div className="leading-tight">
        <p className={cn('text-[15px] font-semibold tracking-tight', light && 'text-white')}>{APP_NAME}</p>
        <p className={cn('text-[11px]', light ? 'text-sidebar-foreground/60' : 'text-muted-foreground')}>Control financiero multiempresa</p>
      </div>
    </div>
  )
}

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const { role } = useSession()
  const { data: summary } = useServiceQuery(() => api.home.summary(), [])
  return (
    <nav className="flex flex-col gap-0.5">
      {NAV.filter((n) => !n.hidden?.(role)).map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} end={to === '/'} onClick={onNavigate}
          className={({ isActive }) => cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground')}>
          <Icon className="size-4" />
          <span className="flex-1">{label}</span>
          {to === '/bandeja' && !!summary?.pending && <span className="num rounded-full bg-amber-400 px-1.5 text-[11px] font-semibold text-amber-950">{summary.pending}</span>}
        </NavLink>
      ))}
    </nav>
  )
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-6 bg-sidebar px-3 py-5 text-sidebar-foreground">
      <div className="px-2"><Logo light /></div>
      <Navigation onNavigate={onNavigate} />
      <div className="mt-auto rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-3 text-xs text-sidebar-foreground/70">
        <p className="font-medium text-sidebar-foreground">Prototipo de demostración</p>
        <p className="mt-0.5">Datos ficticios · IA simulada</p>
      </div>
    </div>
  )
}

export function Layout() {
  const { user, role, today } = useSession()
  const { view, setView } = useUI()
  const { data: cfg } = useServiceQuery(() => api.settings.get(), [user?.email])
  const [menu, setMenu] = useState(false)
  const navigate = useNavigate()

  // Si el rol ya no ve la entidad seleccionada, vuelve a "Grupo".
  useEffect(() => { if (cfg && view !== 'group' && !cfg.entities.some((e) => e.id === view)) setView('group') }, [cfg, view, setView])

  // Atajos ocultos para la demo: llegan mensajes por WhatsApp o correo conectados.
  useEffect(() => {
    const h = async (e: KeyboardEvent) => {
      if (!(e.ctrlKey && e.shiftKey)) return
      const channel = e.key.toLowerCase() === 'w' ? 'whatsapp' : e.key.toLowerCase() === 'e' ? 'email' : null
      if (!channel) return
      e.preventDefault()
      const id = await api.inbox.inject(channel)
      toast(channel === 'whatsapp' ? 'Nuevo mensaje de WhatsApp' : 'Nuevo correo en la bandeja', { description: 'La IA lo está leyendo…', action: { label: 'Revisar', onClick: () => navigate(`/bandeja/${id}`) } })
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [navigate])

  const changeDate = async () => {
    const v = prompt('Fecha "hoy" de la demo (dd/mm/aaaa):', formatDate(today))
    const m = v?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (m) { await api.session.setToday(`${m[3]}-${m[2]}-${m[1]}`); toast.success(`Fecha de la demo: ${v}`) }
  }
  const resetDemoClick = async () => {
    if (!confirm('¿Reiniciar la demo? Se restauran los datos semilla y se pierden los cambios.')) return
    await api.session.resetDemo()
    toast.success('Demo reiniciada')
    navigate('/')
  }

  return (
    <div className="flex min-h-svh bg-background">
      <aside className="sticky top-0 hidden h-svh w-60 shrink-0 lg:block"><Sidebar /></aside>
      <Sheet open={menu} onOpenChange={setMenu}>
        <SheetContent side="left" className="w-64 border-0 p-0" showCloseButton={false}>
          <SheetTitle className="sr-only">Menú</SheetTitle>
          <Sidebar onNavigate={() => setMenu(false)} />
        </SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/90 px-4 backdrop-blur sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMenu(true)} aria-label="Abrir menú"><Menu /></Button>
          <div className="flex min-w-0 items-center gap-2">
            <span className="hidden text-xs font-medium text-muted-foreground sm:inline">Ver:</span>
            <Selector aria-label="Ver" value={view} onChange={(e) => setView(e.target.value)} className="h-8 w-40 sm:w-52"
              options={[{ value: 'group', label: role === 'accountant' ? 'Mis empresas' : 'Grupo' }, ...(cfg?.entities ?? []).map((e) => ({ value: e.id, label: e.name }))]} />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={changeDate} className="hidden items-center gap-1.5 rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-muted sm:flex" title="Fecha de la demo (configurable)">
              <CalendarDays className="size-3.5" />Hoy: <span className="num font-medium text-foreground">{formatDate(today)}</span>
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" className="h-9 gap-2 px-2" />}>
                <span className="grid size-7 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{user?.name.split(' ').map((p) => p[0]).join('').slice(0, 2)}</span>
                <span className="hidden text-left leading-tight md:block"><span className="block text-sm font-medium">{user?.name}</span><span className="block text-[11px] text-muted-foreground">{ROLE_NAMES[role]}</span></span>
                <ChevronDown className="size-4 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Ver la demo como…</DropdownMenuLabel>
                  {DEMO_USERS.map((u) => (
                    <DropdownMenuItem key={u.role} onClick={async () => { await api.session.switchRole(u.role); toast.success(`Ahora ves la plataforma como ${ROLE_NAMES[u.role]}`) }}>
                      <UserRound /><div className="flex-1"><p>{u.name}</p><p className="text-xs text-muted-foreground">{ROLE_NAMES[u.role]}{u.entityIds ? ' · Empresas A y B' : ''}</p></div>{u.role === role && <span className="text-xs text-primary">●</span>}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={changeDate}><CalendarDays />Cambiar fecha de la demo</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/configuracion?tab=historial')}><BookOpen />Registro de cambios</DropdownMenuItem>
                <DropdownMenuItem onClick={resetDemoClick}><RotateCcw />Reiniciar demo</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={async () => { await api.session.close(); navigate('/login') }}><LogOut />Cerrar sesión</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8"><Outlet /></main>
      </div>
      <GlobalPanels />
    </div>
  )
}
