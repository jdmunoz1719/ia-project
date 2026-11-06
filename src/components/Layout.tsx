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
import { Selector } from '@/components/comunes'
import { PanelesGlobales } from '@/components/paneles'
import { useConsulta } from '@/hooks/useConsulta'
import { useSesion } from '@/hooks/useSesion'
import { api, USUARIOS_DEMO } from '@/services/api'
import { useUI } from '@/store/ui'
import { formatFecha } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Rol } from '@/domain/tipos'

export const NOMBRE_APP = 'Caja Clara'
const NAV = [
  { to: '/', label: 'Inicio', icon: Home },
  { to: '/bandeja', label: 'Bandeja', icon: Inbox, oculto: (r: Rol) => r === 'contador' },
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
const ROLES: Record<Rol, string> = { administrador: 'Administrador', asistente: 'Asistente', contador: 'Contador' }

export function Logo({ claro = false }: { claro?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm">
        <svg viewBox="0 0 32 32" className="size-5"><path d="M7 21.5 13.5 15l4 4L25 11" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </div>
      <div className="leading-tight">
        <p className={cn('text-[15px] font-semibold tracking-tight', claro && 'text-white')}>{NOMBRE_APP}</p>
        <p className={cn('text-[11px]', claro ? 'text-sidebar-foreground/60' : 'text-muted-foreground')}>Control financiero multiempresa</p>
      </div>
    </div>
  )
}

function Navegacion({ alNavegar }: { alNavegar?: () => void }) {
  const { rol } = useSesion()
  const { data: resumen } = useConsulta(() => api.inicio.resumen(), [])
  return (
    <nav className="flex flex-col gap-0.5">
      {NAV.filter((n) => !n.oculto?.(rol)).map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} end={to === '/'} onClick={alNavegar}
          className={({ isActive }) => cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground')}>
          <Icon className="size-4" />
          <span className="flex-1">{label}</span>
          {to === '/bandeja' && !!resumen?.pendientes && <span className="num rounded-full bg-amber-400 px-1.5 text-[11px] font-semibold text-amber-950">{resumen.pendientes}</span>}
        </NavLink>
      ))}
    </nav>
  )
}

function Sidebar({ alNavegar }: { alNavegar?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-6 bg-sidebar px-3 py-5 text-sidebar-foreground">
      <div className="px-2"><Logo claro /></div>
      <Navegacion alNavegar={alNavegar} />
      <div className="mt-auto rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-3 text-xs text-sidebar-foreground/70">
        <p className="font-medium text-sidebar-foreground">Prototipo de demostración</p>
        <p className="mt-0.5">Datos ficticios · IA simulada</p>
      </div>
    </div>
  )
}

export function Layout() {
  const { usuario, rol, hoy } = useSesion()
  const { vista, setVista } = useUI()
  const { data: cfg } = useConsulta(() => api.configuracion.obtener(), [usuario?.email])
  const [menu, setMenu] = useState(false)
  const navigate = useNavigate()

  // Si el rol ya no ve la entidad seleccionada, vuelve a "Grupo".
  useEffect(() => { if (cfg && vista !== 'grupo' && !cfg.entidades.some((e) => e.id === vista)) setVista('grupo') }, [cfg, vista, setVista])

  // Atajos ocultos para la demo: llegan mensajes por WhatsApp o correo conectados.
  useEffect(() => {
    const h = async (e: KeyboardEvent) => {
      if (!(e.ctrlKey && e.shiftKey)) return
      const canal = e.key.toLowerCase() === 'w' ? 'whatsapp' : e.key.toLowerCase() === 'e' ? 'correo' : null
      if (!canal) return
      e.preventDefault()
      const id = await api.bandeja.inyectar(canal)
      toast(canal === 'whatsapp' ? 'Nuevo mensaje de WhatsApp' : 'Nuevo correo en la bandeja', { description: 'La IA lo está leyendo…', action: { label: 'Revisar', onClick: () => navigate(`/bandeja/${id}`) } })
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [navigate])

  const cambiarFecha = async () => {
    const v = prompt('Fecha "hoy" de la demo (dd/mm/aaaa):', formatFecha(hoy))
    const m = v?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (m) { await api.sesion.cambiarHoy(`${m[3]}-${m[2]}-${m[1]}`); toast.success(`Fecha de la demo: ${v}`) }
  }
  const reiniciar = async () => {
    if (!confirm('¿Reiniciar la demo? Se restauran los datos semilla y se pierden los cambios.')) return
    await api.sesion.reiniciarDemo()
    toast.success('Demo reiniciada')
    navigate('/')
  }

  return (
    <div className="flex min-h-svh bg-background">
      <aside className="sticky top-0 hidden h-svh w-60 shrink-0 lg:block"><Sidebar /></aside>
      <Sheet open={menu} onOpenChange={setMenu}>
        <SheetContent side="left" className="w-64 border-0 p-0" showCloseButton={false}>
          <SheetTitle className="sr-only">Menú</SheetTitle>
          <Sidebar alNavegar={() => setMenu(false)} />
        </SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/90 px-4 backdrop-blur sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMenu(true)} aria-label="Abrir menú"><Menu /></Button>
          <div className="flex min-w-0 items-center gap-2">
            <span className="hidden text-xs font-medium text-muted-foreground sm:inline">Ver:</span>
            <Selector aria-label="Ver" value={vista} onChange={(e) => setVista(e.target.value)} className="h-8 w-40 sm:w-52"
              opciones={[{ value: 'grupo', label: rol === 'contador' ? 'Mis empresas' : 'Grupo' }, ...(cfg?.entidades ?? []).map((e) => ({ value: e.id, label: e.nombre }))]} />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={cambiarFecha} className="hidden items-center gap-1.5 rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-muted sm:flex" title="Fecha de la demo (configurable)">
              <CalendarDays className="size-3.5" />Hoy: <span className="num font-medium text-foreground">{formatFecha(hoy)}</span>
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" className="h-9 gap-2 px-2" />}>
                <span className="grid size-7 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{usuario?.nombre.split(' ').map((p) => p[0]).join('').slice(0, 2)}</span>
                <span className="hidden text-left leading-tight md:block"><span className="block text-sm font-medium">{usuario?.nombre}</span><span className="block text-[11px] text-muted-foreground">{ROLES[rol]}</span></span>
                <ChevronDown className="size-4 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Ver la demo como…</DropdownMenuLabel>
                  {USUARIOS_DEMO.map((u) => (
                    <DropdownMenuItem key={u.rol} onClick={async () => { await api.sesion.cambiarRol(u.rol); toast.success(`Ahora ves la plataforma como ${ROLES[u.rol]}`) }}>
                      <UserRound /><div className="flex-1"><p>{u.nombre}</p><p className="text-xs text-muted-foreground">{ROLES[u.rol]}{u.entidadIds ? ' · Empresas A y B' : ''}</p></div>{u.rol === rol && <span className="text-xs text-primary">●</span>}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={cambiarFecha}><CalendarDays />Cambiar fecha de la demo</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/configuracion?tab=historial')}><BookOpen />Registro de cambios</DropdownMenuItem>
                <DropdownMenuItem onClick={reiniciar}><RotateCcw />Reiniciar demo</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={async () => { await api.sesion.cerrar(); navigate('/login') }}><LogOut />Cerrar sesión</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8"><Outlet /></main>
      </div>
      <PanelesGlobales />
    </div>
  )
}
