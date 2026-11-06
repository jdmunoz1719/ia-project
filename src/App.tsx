import { lazy, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Layout } from '@/components/Layout'
import { useSession } from '@/hooks/useSession'
import Login from '@/features/login/Login'

const HomePage = lazy(() => import('@/features/home/HomePage'))
const InboxPage = lazy(() => import('@/features/inbox/InboxPage'))
const ReviewPage = lazy(() => import('@/features/inbox/ReviewPage'))
const MovementsPage = lazy(() => import('@/features/movements/MovementsPage'))
const IntercompanyPage = lazy(() => import('@/features/intercompany/IntercompanyPage'))
const DashboardsPage = lazy(() => import('@/features/dashboards/DashboardsPage'))
const LoansPage = lazy(() => import('@/features/loans/LoansPage'))
const LoanDetailPage = lazy(() => import('@/features/loans/LoanDetailPage'))
const MonthClosesPage = lazy(() => import('@/features/closes/MonthClosesPage'))
const AgendaPage = lazy(() => import('@/features/agenda/AgendaPage'))
const ChatPage = lazy(() => import('@/features/chat/ChatPage'))
const ReportsPage = lazy(() => import('@/features/reports/ReportsPage'))
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'))

function Protected({ children }: { children: ReactNode }) {
  const { user, verified } = useSession()
  return user && verified ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <TooltipProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Protected><Layout /></Protected>}>
            <Route index element={<HomePage />} />
            <Route path="bandeja" element={<InboxPage />} />
            <Route path="bandeja/:id" element={<ReviewPage />} />
            <Route path="movimientos" element={<MovementsPage />} />
            <Route path="entre-empresas" element={<IntercompanyPage />} />
            <Route path="tableros" element={<DashboardsPage />} />
            <Route path="creditos" element={<LoansPage />} />
            <Route path="creditos/:id" element={<LoanDetailPage />} />
            <Route path="cierres" element={<MonthClosesPage />} />
            <Route path="agenda" element={<AgendaPage />} />
            <Route path="chat" element={<ChatPage />} />
            <Route path="informes" element={<ReportsPage />} />
            <Route path="configuracion" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster richColors position="top-right" closeButton />
    </TooltipProvider>
  )
}
