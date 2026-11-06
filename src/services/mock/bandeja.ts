import type { CamposPropuesta, EstadoPropuesta, ItemBandeja, Propuesta, TipoHecho } from '@/domain/tipos'
import { formatCOP } from '@/lib/format'
import { procesarEntrada, latenciaIA, type Entrada } from '@/services/ia'
import { extraerChatWhatsApp, extraerExtracto, extraerPropuestas } from '@/services/ia/extractor'
import { ARCHIVOS_DEMO, MENSAJES_ENTRANTES } from '@/services/ia/predefinidas'
import { ahora, demora, exigir, get, registrar, set, uid } from './base'
import { crearHecho, describirEfecto, NOMBRE_TIPO } from './movimientos'

const cfgIA = () => { const s = get(); return { entidades: s.entidades, cuentas: s.cuentas, proyectos: s.proyectos, categorias: s.categorias, terceros: s.terceros, creditos: s.creditos } }

function actualizarItem(itemId: string, fn: (i: ItemBandeja) => ItemBandeja) {
  set((s) => ({
    bandeja: s.bandeja.map((i) => {
      if (i.id !== itemId) return i
      const n = fn(i)
      const abiertas = n.propuestas.some((p) => p.estado === 'pendiente')
      return { ...n, estado: n.estado === 'procesando' ? 'procesando' : abiertas ? 'pendiente' : 'revisado' }
    }),
  }))
}
const actualizarPropuesta = (itemId: string, propId: string, fn: (p: Propuesta) => Propuesta) =>
  actualizarItem(itemId, (i) => ({ ...i, propuestas: i.propuestas.map((p) => (p.id === propId ? fn(p) : p)) }))

/** Crea el ítem en estado "procesando" y, tras la latencia de la IA, llena las propuestas. */
function recibirInterno(e: Entrada, animar = false): string {
  const s = get()
  const { soporte, item } = procesarEntrada(e, cfgIA(), { hechos: s.hechos, soportes: s.soportes })
  const pendiente = { ...item, estado: 'procesando' as const, propuestas: [], entrante: animar }
  set((st) => ({ soportes: [...st.soportes, soporte], bandeja: [pendiente, ...st.bandeja] }))
  registrar('Cargó a la bandeja', soporte.nombre, `Canal: ${e.canal}`, item.id)
  setTimeout(() => {
    set((st) => ({ bandeja: st.bandeja.map((i) => (i.id === item.id ? { ...item } : i)) }))
    registrar('IA propuso registros', soporte.nombre, `${item.propuestas.length} propuesta(s)`, item.id)
  }, latenciaIA())
  return item.id
}

export const bandeja = {
  listar: () => demora(() => {
    const s = get()
    return s.bandeja.map((i) => ({ ...i, soporte: s.soportes.find((x) => x.id === i.soporteId)! }))
  }),

  obtener: (id: string) => demora(() => {
    const s = get()
    const item = s.bandeja.find((i) => i.id === id)
    if (!item) throw new Error('Elemento no encontrado')
    const original = item.archivoDuplicadoDe ? s.bandeja.find((b) => b.soporteId === item.archivoDuplicadoDe) : undefined
    return { item, soporte: s.soportes.find((x) => x.id === item.soporteId)!, historial: s.historial.filter((h) => h.ref === id).reverse(), originalDuplicado: original && { itemId: original.id, recibidoEn: original.recibidoEn } }
  }, 150, 300),

  recibir: (e: Entrada) => demora(() => { exigir('cargar'); return recibirInterno(e) }, 150, 300),

  archivosDemo: () => demora(() => ARCHIVOS_DEMO.map(({ nombre, descripcion, tipoMime, tamano, vista }) => ({ nombre, descripcion, tipoMime, tamano, vista }))),

  cargarArchivoDemo: (nombre: string) => demora(() => {
    exigir('cargar')
    const a = ARCHIVOS_DEMO.find((x) => x.nombre === nombre)!
    return recibirInterno({ canal: a.canal, recibidoEn: ahora(), archivo: { nombre: a.nombre, tipoMime: a.tipoMime, tamano: a.tamano } })
  }, 150, 300),

  /** Simula un mensaje que llega solo por WhatsApp o correo conectado. */
  inyectar: (canal: 'whatsapp' | 'correo') => demora(() => {
    const k = get().entrantes[canal]
    const lista = MENSAJES_ENTRANTES[canal]
    const m = lista[k % lista.length]
    set((s) => ({ entrantes: { ...s.entrantes, [canal]: k + 1 } }))
    const texto = 'asunto' in m ? `${m.asunto}\n\n${m.texto}` : m.texto
    return recibirInterno({ canal, recibidoEn: ahora(), remitente: m.de, texto }, true)
  }, 50, 100),

  efecto: (tipo: TipoHecho, campos: CamposPropuesta) => Promise.resolve(describirEfecto(tipo, campos)),

  aprobar: (itemId: string, propId: string, campos: CamposPropuesta, tipo: TipoHecho | 'tarea', corregida: boolean) => demora(() => {
    exigir('aprobar')
    const item = get().bandeja.find((i) => i.id === itemId)!
    if (tipo === 'tarea') {
      if (!campos.tituloTarea || !campos.vence) throw new Error('La tarea necesita título y fecha de vencimiento')
      const t = { id: uid('t'), titulo: campos.tituloTarea, vence: campos.vence, entidadId: campos.asignaciones?.[0]?.entidadId, creditoId: campos.creditoId, origenPropuestaId: propId, hecha: false }
      set((s) => ({ tareas: [...s.tareas, t] }))
      actualizarPropuesta(itemId, propId, (p) => ({ ...p, tipo, campos, estado: corregida ? 'corregida' : 'aprobada' }))
      registrar('Aprobó tarea', t.titulo, `Vence ${t.vence.split('-').reverse().join('/')}`, itemId)
      return { tipo: 'tarea' as const, id: t.id }
    }
    const h = crearHecho(tipo, { ...campos, origenBandejaId: itemId }, [item.soporteId])
    actualizarPropuesta(itemId, propId, (p) => ({ ...p, tipo, campos, estado: corregida ? 'corregida' : 'aprobada', hechoId: h.id }))
    return { tipo: 'hecho' as const, id: h.id }
  }),

  cambiarEstado: (itemId: string, propId: string, estado: Extract<EstadoPropuesta, 'descartada' | 'rechazada' | 'duplicado' | 'pendiente'>) => demora(() => {
    exigir('aprobar')
    const p = get().bandeja.find((i) => i.id === itemId)!.propuestas.find((x) => x.id === propId)!
    actualizarPropuesta(itemId, propId, (x) => ({ ...x, estado }))
    const verbo = { descartada: 'Descartó', rechazada: 'Rechazó', duplicado: 'Marcó como duplicado', pendiente: 'Reabrió' }[estado]
    registrar(`${verbo} propuesta`, `${NOMBRE_TIPO[p.tipo]}${p.campos.monto ? ' ' + formatCOP(p.campos.monto) : ''}`, '', itemId)
  }),

  releer: (itemId: string) => demora(() => {
    exigir('cargar')
    const item = get().bandeja.find((i) => i.id === itemId)!
    const a = ARCHIVOS_DEMO.find((x) => x.nombre === get().soportes.find((s) => s.id === item.soporteId)?.nombre)
    const t = item.textoExtraido ?? ''
    const nuevas = a?.modo === 'chat' ? extraerChatWhatsApp(t, cfgIA()) : a?.modo === 'extracto' ? extraerExtracto(t, a.cuentaId!, cfgIA()) : extraerPropuestas(t, item.recibidoEn, cfgIA(), a?.opciones)
    actualizarItem(itemId, (i) => ({ ...i, estado: 'procesando', propuestas: i.propuestas.filter((p) => p.estado !== 'pendiente') }))
    setTimeout(() => {
      set((s) => ({ bandeja: s.bandeja.map((i) => (i.id === itemId ? { ...i, estado: 'pendiente', propuestas: [...i.propuestas, ...nuevas] } : i)) }))
    }, latenciaIA())
    registrar('Volvió a leer con IA', a?.nombre ?? 'Mensaje', '', itemId)
  }),

  agregarManual: (itemId: string, tipo: 'registro' | 'tarea') => demora(() => {
    exigir('cargar')
    const p: Propuesta = { id: uid('p'), tipo: tipo === 'tarea' ? 'tarea' : 'gasto', confianza: 100, evidencia: [], estado: 'pendiente', nota: 'Agregado a mano', campos: { fecha: get().hoy, vence: tipo === 'tarea' ? get().hoy : undefined, asignaciones: [] } }
    actualizarItem(itemId, (i) => ({ ...i, propuestas: [...i.propuestas, p] }))
    return p.id
  }, 100, 200),
}
