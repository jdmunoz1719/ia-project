import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { KeyRound, Loader2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Logo } from '@/components/Layout'
import { Campo } from '@/components/comunes'
import { useSesion } from '@/hooks/useSesion'
import { api, CODIGO_2FA_DEMO, USUARIOS_DEMO } from '@/services/api'
import { cn } from '@/lib/utils'

// ponytail: login simulado para la demo; el producto real usa backend con contraseñas cifradas y TOTP.
export default function Login() {
  const { usuario, verificado } = useSesion()
  const navigate = useNavigate()
  const [email, setEmail] = useState(USUARIOS_DEMO[0].email)
  const [clave, setClave] = useState('demo2026')
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  if (usuario && verificado) return <Navigate to="/" replace />
  const paso2 = !!usuario && !verificado

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setCargando(true)
    try {
      if (!paso2) await api.sesion.iniciar(email, clave)
      else { await api.sesion.verificar(codigo); navigate('/') }
    } catch (err) { setError((err as Error).message) } finally { setCargando(false) }
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <Logo claro />
        <div className="relative z-10 max-w-md space-y-4">
          <h2 className="text-3xl font-semibold leading-tight text-white">Lo que hoy está regado en WhatsApp y Excel, en un solo lugar.</h2>
          <p className="text-sidebar-foreground/75">Cargue como le llegue la información. La IA propone, usted aprueba y el sistema calcula: saldos, deudas entre empresas, créditos y cierres.</p>
          <ul className="space-y-2 text-sm text-sidebar-foreground/80">
            {['Cinco empresas y asuntos personales', 'Cada hecho se registra una sola vez', 'Desde cualquier cifra hasta el soporte original'].map((t) => <li key={t} className="flex items-center gap-2"><ShieldCheck className="size-4 text-sidebar-primary" />{t}</li>)}
          </ul>
        </div>
        <p className="text-xs text-sidebar-foreground/50">Prototipo de demostración · datos ficticios</p>
        <div className="pointer-events-none absolute -right-32 -bottom-32 size-[28rem] rounded-full bg-sidebar-primary/10" />
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={enviar} className="w-full max-w-sm space-y-6">
          <div className="lg:hidden"><Logo /></div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{paso2 ? 'Verificación en dos pasos' : 'Iniciar sesión'}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{paso2 ? `Escriba el código de 6 dígitos de su app de autenticación, ${usuario!.nombre.split(' ')[0]}.` : 'Acceso seguro para el equipo administrativo.'}</p>
          </div>
          {!paso2 ? (
            <div className="space-y-4">
              <Campo etiqueta="Correo"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" /></Campo>
              <Campo etiqueta="Contraseña"><Input type="password" value={clave} onChange={(e) => setClave(e.target.value)} autoComplete="current-password" /></Campo>
              <div className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
                <p className="mb-1.5 font-medium text-foreground">Usuarios de la demo</p>
                <div className="flex flex-wrap gap-1.5">
                  {USUARIOS_DEMO.map((u) => (
                    <button type="button" key={u.email} onClick={() => setEmail(u.email)} className={cn('rounded-md border px-2 py-1 transition hover:bg-background', email === u.email && 'border-primary bg-background text-primary')}>
                      {u.rol === 'administrador' ? 'Administrador' : u.rol === 'asistente' ? 'Asistente' : 'Contador'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Input autoFocus inputMode="numeric" maxLength={6} value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
                className="num h-12 text-center text-2xl tracking-[0.5em]" placeholder="••••••" />
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><KeyRound className="size-3.5" />Código de la demo: <span className="num font-semibold text-foreground">{CODIGO_2FA_DEMO}</span></p>
            </div>
          )}
          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <Button type="submit" className="h-10 w-full" disabled={cargando || (paso2 && codigo.length !== 6)}>
            {cargando && <Loader2 className="animate-spin" />}{paso2 ? 'Verificar' : 'Continuar'}
          </Button>
          {paso2 && <button type="button" className="w-full text-center text-sm text-muted-foreground hover:underline" onClick={() => api.sesion.cerrar()}>Usar otra cuenta</button>}
        </form>
      </div>
    </div>
  )
}
