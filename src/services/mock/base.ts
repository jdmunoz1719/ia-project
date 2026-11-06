// Utilidades compartidas por los servicios mock.
import { expandirTodos } from '@/domain/libro'
import type { Contexto } from '@/domain/indicadores'
import type { Hecho, LineaLibro, Propuesta, Rol } from '@/domain/tipos'
import { useDemo, type EstadoDemo } from '@/store/demo'

export const get = () => useDemo.getState()
export const set = (fn: (s: EstadoDemo) => Partial<EstadoDemo>) => useDemo.setState(fn)

/** Latencia simulada de red (200–600 ms). */
export const demora = <T>(valor: T | (() => T), min = 200, max = 600): Promise<T> =>
  new Promise((ok, mal) => setTimeout(() => {
    try { ok(typeof valor === 'function' ? (valor as () => T)() : valor) } catch (e) { mal(e) }
  }, min + Math.random() * (max - min)))

export const uid = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
export const ahora = () => {
  // La hora es real; la fecha es la "hoy" de la demo.
  const d = new Date()
  return `${get().hoy}T${d.toTimeString().slice(0, 8)}`
}

export function registrar(accion: string, objeto: string, detalle = '', ref?: string) {
  const usuario = get().sesion.usuario?.nombre ?? 'Sistema'
  set((s) => ({ historial: [...s.historial, { fecha: ahora(), usuario, accion, objeto, detalle, ref }] }))
}

// ---------- Permisos ----------
export type Permiso = 'cargar' | 'aprobar' | 'editar' | 'configurar'
export const PERMISOS: Record<Rol, Permiso[]> = {
  administrador: ['cargar', 'aprobar', 'editar', 'configurar'],
  asistente: ['cargar'],
  contador: [],
}
export function exigir(p: Permiso) {
  const rol = get().sesion.usuario?.rol ?? 'administrador'
  if (!PERMISOS[rol].includes(p)) throw new Error(`Tu rol (${rol}) no permite esta acción`)
}
export function visibles(): Set<string> {
  const u = get().sesion.usuario
  const todas = get().entidades.map((e) => e.id)
  return new Set(u?.rol === 'contador' && u.entidadIds ? u.entidadIds : todas)
}
export const hechoVisible = (h: Hecho, v = visibles()) => v.has(h.entidadPagadoraId) || h.asignaciones.some((a) => v.has(a.entidadId))

// ---------- Libro (memoizado por referencia) ----------
let cache: { hechos: Hecho[]; cuentas: unknown; lineas: LineaLibro[] } | null = null
export function lineas(): LineaLibro[] {
  const s = get()
  if (!cache || cache.hechos !== s.hechos || cache.cuentas !== s.cuentas) cache = { hechos: s.hechos, cuentas: s.cuentas, lineas: expandirTodos(s.hechos, s.cuentas) }
  return cache.lineas
}
export const lineasVisibles = () => { const v = visibles(); return lineas().filter((l) => v.has(l.entidadId)) }

export const pendientes = (): Propuesta[] => get().bandeja.flatMap((b) => b.propuestas.filter((p) => p.estado === 'pendiente'))

export function contexto(): Contexto {
  const s = get(); const v = visibles()
  return {
    entidades: s.entidades.filter((e) => v.has(e.id)),
    cuentas: s.cuentas.filter((c) => v.has(c.entidadId)),
    proyectos: s.proyectos.filter((p) => v.has(p.entidadId)),
    pendientes: pendientes(),
  }
}

export const nombreEntidad = (id?: string) => get().entidades.find((e) => e.id === id)?.nombre ?? '—'
export const nombreCuenta = (id?: string) => get().cuentas.find((c) => c.id === id)?.banco ?? '—'

/** Un mes con cierre publicado bloquea los hechos de las cuentas (o entidades) cerradas. */
export function mesBloqueado(h: Pick<Hecho, 'fecha' | 'cuentaOrigenId' | 'cuentaDestinoId' | 'entidadPagadoraId'>): boolean {
  const mes = h.fecha.slice(0, 7)
  const cierres = get().cierres.filter((c) => c.mes === mes && c.estado === 'publicado')
  const ctas = [h.cuentaOrigenId, h.cuentaDestinoId].filter(Boolean)
  return cierres.some((c) => (ctas.length ? ctas.includes(c.cuentaId) : c.entidadId === h.entidadPagadoraId))
}
export function exigirMesAbierto(h: Parameters<typeof mesBloqueado>[0]) {
  if (mesBloqueado(h)) throw new Error(`El mes ${h.fecha.slice(5, 7)}/${h.fecha.slice(0, 4)} tiene un cierre publicado. Reábrelo para registrar o editar movimientos.`)
}
