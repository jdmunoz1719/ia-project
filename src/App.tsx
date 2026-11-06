import { lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Layout } from '@/components/Layout'
import { Cargando } from '@/components/comunes'
import { useSesion } from '@/hooks/useSesion'
import Login from '@/features/login/Login'

const Inicio = lazy(() => import('@/features/inicio/Inicio'))
const Bandeja = lazy(() => import('@/features/bandeja/Bandeja'))
const Revision = lazy(() => import('@/features/bandeja/Revision'))
const Movimientos = lazy(() => import('@/features/movimientos/Movimientos'))
const EntreEmpresas = lazy(() => import('@/features/intercompanias/EntreEmpresas'))
const Tableros = lazy(() => import('@/features/tableros/Tableros'))
const Creditos = lazy(() => import('@/features/creditos/Creditos'))
const DetalleCredito = lazy(() => import('@/features/creditos/DetalleCredito'))
const Cierres = lazy(() => import('@/features/cierres/Cierres'))
const Agenda = lazy(() => import('@/features/agenda/Agenda'))
const Chat = lazy(() => import('@/features/chat/Chat'))
const Informes = lazy(() => import('@/features/informes/Informes'))
const Configuracion = lazy(() => import('@/features/configuracion/Configuracion'))

function Protegida({ children }: { children: ReactNode }) {
  const { usuario, verificado } = useSesion()
  return usuario && verificado ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <TooltipProvider>
      <BrowserRouter>
        <Suspense fallback={<div className="p-8"><Cargando filas={6} /></div>}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<Protegida><Layout /></Protegida>}>
              <Route index element={<Inicio />} />
              <Route path="bandeja" element={<Bandeja />} />
              <Route path="bandeja/:id" element={<Revision />} />
              <Route path="movimientos" element={<Movimientos />} />
              <Route path="entre-empresas" element={<EntreEmpresas />} />
              <Route path="tableros" element={<Tableros />} />
              <Route path="creditos" element={<Creditos />} />
              <Route path="creditos/:id" element={<DetalleCredito />} />
              <Route path="cierres" element={<Cierres />} />
              <Route path="agenda" element={<Agenda />} />
              <Route path="chat" element={<Chat />} />
              <Route path="informes" element={<Informes />} />
              <Route path="configuracion" element={<Configuracion />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster richColors position="top-right" closeButton />
    </TooltipProvider>
  )
}
