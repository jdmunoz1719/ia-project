// Contrato de acceso a datos. Las pantallas sólo importan `api` desde aquí.
// Hoy se implementa con mocks en memoria; mañana se reemplaza por `services/http` (NestJS)
// cumpliendo el mismo tipo `Api`, sin tocar las pantallas.
import { useDemo } from '@/store/demo'
import { bandeja } from './mock/bandeja'
import { intercompanias, movimientos } from './mock/movimientos'
import { agenda, cierres, configuracion, creditos, sesion } from './mock/otros'
import { chat, informes, inicio, tableros } from './mock/tableros'

export const api = {
  sesion, configuracion, bandeja, movimientos, intercompanias, tableros, inicio, creditos, cierres, agenda, chat, informes,
  /** Avisa cuando cambian los datos (en HTTP sería un websocket o invalidación de caché). */
  suscribir: (cb: () => void) => useDemo.subscribe(cb),
}
export type Api = typeof api
type Resuelto<F> = F extends (...a: never[]) => Promise<infer R> ? R : never
export type Config = Resuelto<Api['configuracion']['obtener']>

export { NOMBRE_TIPO } from './mock/movimientos'
export type { FiltrosMovimientos, FilaMovimiento } from './mock/movimientos'
export { PERMISOS, type Permiso } from './mock/base'
export { USUARIOS_DEMO, CODIGO_2FA_DEMO } from './mock/otros'
export type { Entrada } from './ia'
export type { RespuestaChat } from './mock/tableros'
