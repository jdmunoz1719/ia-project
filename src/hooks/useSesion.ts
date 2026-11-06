import { useSyncExternalStore } from 'react'
import { api, PERMISOS, type Permiso } from '@/services/api'
import { useDemo } from '@/store/demo'

// ponytail: lectura síncrona de la sesión para guardas de ruta y permisos (en HTTP vendría del token).
const leer = () => useDemo.getState().sesion
const leerHoy = () => useDemo.getState().hoy
export function useSesion() {
  const sesion = useSyncExternalStore(api.suscribir, leer)
  const hoy = useSyncExternalStore(api.suscribir, leerHoy)
  const rol = sesion.usuario?.rol ?? 'administrador'
  return { ...sesion, hoy, rol, puede: (p: Permiso) => PERMISOS[rol].includes(p) }
}
