import { useSyncExternalStore } from 'react'
import { api, PERMISSIONS, type Permission } from '@/services/api'
import { useDemo } from '@/store/demo'

// ponytail: lectura síncrona de la sesión para guardas de ruta y permisos (en HTTP vendría del token).
const readSession = () => useDemo.getState().session
const readToday = () => useDemo.getState().today
export function useSession() {
  const session = useSyncExternalStore(api.subscribe, readSession)
  const today = useSyncExternalStore(api.subscribe, readToday)
  const role = session.user?.role ?? 'admin'
  return { ...session, today, role, can: (p: Permission) => PERMISSIONS[role].includes(p) }
}
