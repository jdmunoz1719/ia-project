import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { KeyRound, Loader2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Logo } from '@/components/Layout'
import { Field } from '@/components/common'
import { useSession } from '@/hooks/useSession'
import { api, DEMO_2FA_CODE, DEMO_USERS } from '@/services/api'
import { cn } from '@/lib/utils'

// ponytail: login simulado para la demo; el producto real usa backend con contraseñas cifradas y TOTP.
export default function Login() {
  const { user, verified } = useSession()
  const navigate = useNavigate()
  const [email, setEmail] = useState(DEMO_USERS[0].email)
  const [password, setPassword] = useState('demo2026')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  if (user && verified) return <Navigate to="/" replace />
  const secondStep = !!user && !verified

  const send = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true)
    try {
      if (!secondStep) await api.session.signIn(email, password)
      else { await api.session.verify(code); navigate('/') }
    } catch (err) { setError((err as Error).message) } finally { setLoading(false) }
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <Logo light />
        <div className="relative z-10 max-w-md space-y-4">
          <h2 className="text-3xl font-semibold leading-tight text-white">Lo que hoy está regado en WhatsApp y Excel, en un solo lugar.</h2>
          <p className="text-sidebar-foreground/75">Carga la información como te llegue. La IA propone, tú apruebas y el sistema calcula: saldos, deudas entre empresas, créditos y cierres.</p>
          <ul className="space-y-2 text-sm text-sidebar-foreground/80">
            {['Cinco empresas y asuntos personales', 'Cada hecho se registra una sola vez', 'Desde cualquier cifra hasta el soporte original'].map((t) => <li key={t} className="flex items-center gap-2"><ShieldCheck className="size-4 text-sidebar-primary" />{t}</li>)}
          </ul>
        </div>
        <p className="text-xs text-sidebar-foreground/50">Prototipo de demostración · datos ficticios</p>
        <div className="pointer-events-none absolute -right-32 -bottom-32 size-[28rem] rounded-full bg-sidebar-primary/10" />
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={send} className="w-full max-w-sm space-y-6">
          <div className="lg:hidden"><Logo /></div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{secondStep ? 'Verificación en dos pasos' : 'Iniciar sesión'}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{secondStep ? `Escribe el código de 6 dígitos de tu app de autenticación, ${user!.name.split(' ')[0]}.` : 'Acceso seguro para el equipo administrativo.'}</p>
          </div>
          {!secondStep ? (
            <div className="space-y-4">
              <Field label="Correo"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" /></Field>
              <Field label="Contraseña"><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></Field>
              <div className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
                <p className="mb-1.5 font-medium text-foreground">Usuarios de la demo</p>
                <div className="flex flex-wrap gap-1.5">
                  {DEMO_USERS.map((u) => (
                    <button type="button" key={u.email} onClick={() => setEmail(u.email)} className={cn('rounded-md border px-2 py-1 transition hover:bg-background', email === u.email && 'border-primary bg-background text-primary')}>
                      {u.role === 'admin' ? 'Administrador' : u.role === 'assistant' ? 'Asistente' : 'Contador'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Input autoFocus inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className="num h-12 text-center text-2xl tracking-[0.5em]" placeholder="••••••" />
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><KeyRound className="size-3.5" />Código de la demo: <span className="num font-semibold text-foreground">{DEMO_2FA_CODE}</span></p>
            </div>
          )}
          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <Button type="submit" className="h-10 w-full" disabled={loading || (secondStep && code.length !== 6)}>
            {loading && <Loader2 className="animate-spin" />}{secondStep ? 'Verificar' : 'Continuar'}
          </Button>
          {secondStep && <button type="button" className="w-full text-center text-sm text-muted-foreground hover:underline" onClick={() => api.session.close()}>Usar otra cuenta</button>}
        </form>
      </div>
    </div>
  )
}
