// Contrato de acceso a datos. Las pantallas sólo importan `api` desde aquí.
// Hoy se implementa con mocks en memoria; mañana se reemplaza por `services/http` (NestJS)
// cumpliendo el mismo tipo `Api`, sin tocar las pantallas.
import { useDemo } from '@/store/demo'
import { inbox } from './mock/inbox'
import { intercompany, movements } from './mock/movements'
import { agenda, monthCloses, settings, loans, session } from './mock/others'
import { chat, home, reports, dashboards } from './mock/dashboards'

export const api = {
  session, settings, inbox, movements, intercompany, dashboards, home, loans, monthCloses, agenda, chat, reports,
  /** Avisa cuando cambian los datos (en HTTP sería un websocket o invalidación de caché). */
  subscribe: (cb: () => void) => useDemo.subscribe(cb),
}
export type Api = typeof api
type Resolved<F> = F extends (...a: never[]) => Promise<infer R> ? R : never
export type Config = Resolved<Api['settings']['get']>

export { TYPE_NAME } from './mock/movements'
export type { TransactionFilters, TransactionRow, Direction } from './mock/movements'
export { PERMISSIONS, type Permission } from './mock/base'
export { DEMO_USERS, DEMO_2FA_CODE } from './mock/others'
export type { IntakeInput } from './ai'
export type { ChatAnswer } from './mock/dashboards'
