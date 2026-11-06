// "IA simulada", capa 1: extractor por reglas sobre texto libre en español colombiano.
// Sólo asigna entidades, cuentas, proyectos, categorías y terceros que existan en la configuración.
import { addDays, addMonths, format, parseISO, subMonths } from 'date-fns'
import type { Categoria, Credito, Cuenta, Entidad, Evidencia, Propuesta, Proyecto, Tercero, TipoHecho } from '@/domain/tipos'

export type ConfigIA = {
  entidades: Entidad[]; cuentas: Cuenta[]; proyectos: Proyecto[]; categorias: Categoria[]
  terceros: Tercero[]; creditos: Credito[]
}
export type OpcionesIA = {
  /** Trata todo el texto como un solo registro (recibos, facturas, correos). */
  unSoloRegistro?: boolean
  /** Tipo conocido de antemano por el tipo de documento. */
  tipo?: TipoHecho | 'tarea'
  tituloTarea?: string
  /** Desplazamiento del texto dentro del original (para la evidencia). */
  offset?: number
}

let contador = 0
const nuevoId = () => `p-${Date.now().toString(36)}-${(contador++).toString(36)}`

/** Minúsculas sin tildes, conservando la longitud (para que las posiciones coincidan con el original). */
export const normalizar = (s: string) => Array.from(s, (ch) => ch.normalize('NFD').replace(/[̀-ͯ]/g, '') || ch).join('').toLowerCase()
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const palabra = (alias: string) => new RegExp(`(?<![a-z0-9])${esc(normalizar(alias))}(?![a-z0-9])`, 'g')

type Hallazgo<T> = { item: T; inicio: number; fin: number }
function buscarAlias<T extends { alias: string[]; nombre?: string }>(txt: string, items: T[], conNombre = false): Hallazgo<T>[] {
  const out: Hallazgo<T>[] = []
  for (const item of items) {
    const alias = [...item.alias, ...(conNombre && item.nombre ? [item.nombre] : [])]
    for (const a of alias) for (const m of txt.matchAll(palabra(a))) out.push({ item, inicio: m.index!, fin: m.index! + m[0].length })
  }
  // Quita solapados dejando el más largo.
  out.sort((a, b) => (b.fin - b.inicio) - (a.fin - a.inicio))
  const elegidos: Hallazgo<T>[] = []
  for (const h of out) if (!elegidos.some((e) => h.inicio < e.fin && e.inicio < h.fin)) elegidos.push(h)
  return elegidos.sort((a, b) => a.inicio - b.inicio)
}

// ---------------- Montos ----------------
const RE_MILLONES = /(\$\s?)?(\d{1,3}(?:[.,]\d{1,3})?)\s*(?:millones|millon|mill|palos)(?![a-z])/g
const RE_MIL = /(\$\s?)?(\d{1,3})\s*mil(?![a-z])/g
const RE_PUNTOS = /(\$\s?)?\d{1,3}(?:\.\d{3})+(?!\d)/g
const RE_DIGITOS = /(\$\s?)?(?<![\d/])\d{4,9}(?![\d/])/g

type Monto = { valor: number; inicio: number; fin: number; preferido: boolean }
function buscarMontos(t: string): Monto[] {
  const out: Monto[] = []
  const ocupado = (i: number, f: number) => out.some((m) => i < m.fin && m.inicio < f)
  const pref = (i: number, conPeso: boolean) => conPeso || /(total|valor|suma|por|de|pagar)\W{0,4}$/.test(t.slice(Math.max(0, i - 14), i))
  for (const m of t.matchAll(RE_MILLONES)) { const v = Math.round(parseFloat(m[2].replace(',', '.')) * 1e6); out.push({ valor: v, inicio: m.index!, fin: m.index! + m[0].length, preferido: pref(m.index!, !!m[1]) }) }
  for (const m of t.matchAll(RE_MIL)) if (!ocupado(m.index!, m.index! + m[0].length)) out.push({ valor: Number(m[2]) * 1000, inicio: m.index!, fin: m.index! + m[0].length, preferido: pref(m.index!, !!m[1]) })
  for (const m of t.matchAll(RE_PUNTOS)) if (!ocupado(m.index!, m.index! + m[0].length)) out.push({ valor: Number(m[0].replace(/[$\s.]/g, '')), inicio: m.index!, fin: m.index! + m[0].length, preferido: pref(m.index!, !!m[1]) })
  for (const m of t.matchAll(RE_DIGITOS)) if (!ocupado(m.index!, m.index! + m[0].length)) out.push({ valor: Number(m[0].replace(/[$\s]/g, '')), inicio: m.index!, fin: m.index! + m[0].length, preferido: !!m[1] })
  return out.filter((m) => m.valor >= 1000).sort((a, b) => a.inicio - b.inicio)
}

// ---------------- Fechas ----------------
const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
type Fecha = { valor: string; inicio: number; fin: number }
const iso = (d: Date) => format(d, 'yyyy-MM-dd')

function buscarFecha(t: string, recibido: string, futuro: boolean): Fecha | undefined {
  const base = parseISO(recibido)
  const candidatos: Fecha[] = []
  const push = (m: RegExpMatchArray, d: Date) => candidatos.push({ valor: iso(d), inicio: m.index!, fin: m.index! + m[0].length })
  for (const m of t.matchAll(/(?<!\d)(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?!\d)/g)) {
    const y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : base.getFullYear()
    const d = new Date(y, Number(m[2]) - 1, Number(m[1]))
    if (!isNaN(d.getTime()) && Number(m[2]) <= 12) push(m, d)
  }
  const rel: [RegExp, number][] = [[/pasado manana/g, 2], [/(?<!pasado )manana/g, 1], [/antier|anteayer/g, -2], [/(?<![a-z])ayer/g, -1], [/(?<![a-z])hoy(?![a-z])/g, 0]]
  for (const [re, d] of rel) for (const m of t.matchAll(re)) push(m, addDays(base, d))
  for (const m of t.matchAll(/(?:el|este|el pasado|el proximo)\s+(lunes|martes|miercoles|jueves|viernes|sabado|domingo)/g)) {
    const objetivo = DIAS.indexOf(m[1])
    let diff = objetivo - base.getDay()
    if (futuro) { if (diff <= 0) diff += 7 } else if (diff >= 0) diff -= 7
    push(m, addDays(base, diff))
  }
  for (const m of t.matchAll(/(?:el|el dia)\s+(\d{1,2})(?![\d/.,]|\s*(?:mil|millon|de\s+\w+\s+de))/g)) {
    const dia = Number(m[1]); if (dia < 1 || dia > 31) continue
    let d = new Date(base.getFullYear(), base.getMonth(), dia)
    if (futuro && dia < base.getDate()) d = addMonths(d, 1)
    if (!futuro && dia > base.getDate()) d = subMonths(d, 1)
    push(m, d)
  }
  return candidatos.sort((a, b) => a.inicio - b.inicio)[0]
}

// ---------------- Tipo de movimiento ----------------
const TIPOS: [RegExp, TipoHecho | 'tarea'][] = [
  [/hay que|toca |tenemos que|recordar|no olvidar|pendiente pagar|fecha limite|vence el/, 'tarea'],
  [/cuota del credito|cuota del leasing|abone al credito|pague la cuota/, 'pago_credito'],
  [/(?<![a-z])(pase|traslade|traslado|movi)(?![a-z])/, 'traslado'],
  [/devolvi|le devolvio|devolucion a la empresa|le devolvimos/, 'pago_intercompania'],
  [/recibi|recibimos|nos consignaron|nos pagaron|cobre|entro|consignaron|abonaron|nos transfirieron/, 'ingreso'],
  [/invertimos|inversion en|adecuacion/, 'inversion_proyecto'],
  [/pague|pago|gaste|compre|transferi|le consigne|cancele|salio|pagamos/, 'gasto'],
]
const tipoDe = (t: string) => TIPOS.find(([re]) => re.test(t))?.[1]

const CLASES_POR_TIPO: Record<string, string[]> = {
  ingreso: ['ingreso'], gasto: ['gasto_operativo', 'costo_venta', 'financiero'], costo: ['costo_venta'],
  interes: ['financiero'], inversion_proyecto: ['inversion'], tarea: ['gasto_operativo', 'costo_venta', 'financiero'],
}

// ---------------- Segmentación ----------------
const CONECTOR_VERBO = '(?:pague|pago|gaste|recibi|nos consignaron|cobre|pase|traslade|hay que|toca|manana|tambien|compre|transferi)'
function segmentar(t: string): { inicio: number; fin: number }[] {
  const cortes = [0]
  const re = new RegExp(`\\.(?=\\s|$)|[;\\n!?]|\\s(?:ademas|y luego|y tambien)\\s|\\sy\\s(?=${CONECTOR_VERBO})`, 'g')
  for (const m of t.matchAll(re)) cortes.push(m.index! + m[0].length)
  cortes.push(t.length)
  return cortes.slice(0, -1).map((c, i) => ({ inicio: c, fin: cortes[i + 1] })).filter((s) => /[a-z0-9]/.test(t.slice(s.inicio, s.fin)))
}

function tituloDeTarea(original: string): string {
  const s = original.trim().replace(/^[\s,.-]+|[\s.]+$/g, '')
  const m = normalizar(s).match(/(hay que|toca|tenemos que|recordar|no olvidar)\s+/)
  let r = m ? s.slice(m.index! + m[0].length) : s
  r = r.replace(/^(\p{L}+)\s+(la|el|los|las)\s+/u, '$1 ')
  r = r.replace(/\s+(manana|mañana|pasado mañana|el \d{1,2}|el (lunes|martes|miércoles|jueves|viernes|sábado|domingo))$/i, '')
  return r.charAt(0).toUpperCase() + r.slice(1)
}

/** Extrae propuestas de un texto. `recibido` es la fecha ISO de recepción (base para "ayer", "mañana"…). */
export function extraerPropuestas(texto: string, recibido: string, cfg: ConfigIA, op: OpcionesIA = {}): Propuesta[] {
  const off = op.offset ?? 0
  const N = normalizar(texto)
  const segmentos = op.unSoloRegistro ? [{ inicio: 0, fin: texto.length }] : segmentar(N)
  const out: Propuesta[] = []

  for (const seg of segmentos) {
    const t = N.slice(seg.inicio, seg.fin)
    const tipoDetectado = op.tipo ?? tipoDe(t)
    const montos = buscarMontos(t.replace(/(nit|no\.|nro\.?|factura|fe-|ref\.?)[\s:#]*[\w.-]+/g, (x) => ' '.repeat(x.length)))
    const credito = cfg.creditos.find((c) => {
      const n = normalizar(c.nombre); return t.includes(n) || t.includes(n.replace(/^credito\s+/, ''))
    })
    if (!tipoDetectado && montos.length === 0 && !credito) continue
    const tipo: TipoHecho | 'tarea' = tipoDetectado ?? 'gasto'
    const esTarea = tipo === 'tarea'

    const ev: Evidencia[] = []
    const evid = (campo: string, i: number, f: number) => ev.push({ campo, textoFuente: texto.slice(seg.inicio + i, seg.inicio + f), inicio: off + seg.inicio + i, fin: off + seg.inicio + f })
    let confianza = 95
    const notas: string[] = []
    if (!tipoDetectado) { confianza -= 15; notas.push('No se reconoció el tipo de movimiento') }

    // Monto
    const monto = montos.find((m) => m.preferido) ?? montos[0]
    if (monto) evid('monto', monto.inicio, monto.fin)

    // Fecha
    const fecha = buscarFecha(t, recibido.slice(0, 10), esTarea)
    if (fecha) evid(esTarea ? 'vence' : 'fecha', fecha.inicio, fecha.fin)

    // Cuentas, entidades, proyectos, terceros, categorías
    const hCuentas = buscarAlias(t, cfg.cuentas)
    const hEntidades = buscarAlias(t, cfg.entidades, true)
    const hProyectos = buscarAlias(t, cfg.proyectos)
    const hTerceros = buscarAlias(t, cfg.terceros)
    const clasesOk = CLASES_POR_TIPO[tipo] ?? []
    const hCategorias = buscarAlias(t, cfg.categorias.filter((c) => clasesOk.includes(c.clase)))

    // Entidades pegadas a una cuenta ("Bancolombia de la Empresa B") = dueña de la cuenta.
    const entDeCuenta = (h: Hallazgo<Cuenta>) => hEntidades.find((e) => e.inicio >= h.fin && e.inicio - h.fin <= 12)
    const resolverCuenta = (h: Hallazgo<Cuenta>) => {
      const mismas = cfg.cuentas.filter((c) => c.alias.some((a) => normalizar(a) === normalizar(texto.slice(seg.inicio + h.inicio, seg.inicio + h.fin))))
      const pegada = entDeCuenta(h)
      if (mismas.length > 1) {
        const r = pegada && mismas.find((c) => c.entidadId === pegada.item.id)
        if (!r) { confianza -= 10; notas.push('La cuenta mencionada es ambigua') }
        return r
      }
      if (pegada && pegada.item.id !== h.item.entidadId) { confianza -= 10; notas.push(`${h.item.nombre} no pertenece a ${pegada.item.nombre}`) }
      return h.item
    }
    const cuentasRes = hCuentas.map((h) => ({ h, cuenta: resolverCuenta(h) }))
    const ctaOrigen = cuentasRes[0]
    const ctaDestino = tipo === 'traslado' || tipo === 'pago_intercompania' ? cuentasRes[1] : undefined
    for (const [i, c] of [ctaOrigen, ctaDestino].entries()) if (c?.cuenta) evid(i === 0 && tipo !== 'ingreso' ? 'cuentaOrigenId' : 'cuentaDestinoId', c.h.inicio, c.h.fin)

    const pegadas = new Set(cuentasRes.map((c) => entDeCuenta(c.h)).filter(Boolean))
    const entLibre = hEntidades.find((e) => !pegadas.has(e))
    const proyecto = hProyectos[0]
    if (proyecto) evid('proyectoId', proyecto.inicio, proyecto.fin)
    const tercero = hTerceros[0]
    if (tercero) evid('terceroId', tercero.inicio, tercero.fin)
    const categoria = hCategorias[0]
    if (categoria) evid('categoriaId', categoria.inicio, categoria.fin)

    const cuentaPrincipal = ctaOrigen?.cuenta
    const pagadora = cuentaPrincipal?.entidadId ?? entLibre?.item.id ?? proyecto?.item.entidadId ?? credito?.entidadId
    const duena = (tipo === 'traslado' || tipo === 'pago_intercompania')
      ? ctaDestino?.cuenta?.entidadId ?? entLibre?.item.id
      : proyecto?.item.entidadId ?? entLibre?.item.id ?? credito?.entidadId ?? pagadora
    for (const e of hEntidades) evid(pegadas.has(e) ? 'entidadPagadoraId' : 'entidadId', e.inicio, e.fin)

    // Confianza: −20 por cada campo clave faltante, −5 si la fecha se toma de la recepción.
    if (!monto && !esTarea) { confianza -= 20; notas.push('Falta el monto') }
    if (!fecha) { confianza -= esTarea ? 20 : 5; notas.push(esTarea ? 'Falta la fecha de vencimiento' : 'Fecha tomada de la recepción') }
    if (!duena && !esTarea) { confianza -= 20; notas.push('No se identificó la empresa') }
    if (montos.length > 1 && !montos.some((m) => m.preferido)) { confianza -= 10; notas.push('Hay varios montos en el texto') }

    const fechaFinal = fecha?.valor ?? recibido.slice(0, 10)
    const tipoFinal: TipoHecho | 'tarea' = tipo === 'gasto' && categoria?.item.clase === 'costo_venta' ? 'costo' : tipo === 'gasto' && categoria?.item.clase === 'financiero' && !credito ? 'interes' : tipo
    const p: Propuesta = {
      id: nuevoId(), tipo: tipoFinal, confianza: Math.max(5, Math.min(99, confianza)), evidencia: ev, estado: 'pendiente',
      nota: notas.join(' · ') || undefined,
      campos: esTarea
        ? { tituloTarea: op.tituloTarea ?? tituloDeTarea(texto.slice(seg.inicio, seg.fin)), vence: fecha?.valor, creditoId: credito?.id, monto: monto?.valor,
            asignaciones: duena ? [{ entidadId: duena, monto: monto?.valor ?? 0 }] : [], entidadPagadoraId: pagadora, categoriaId: categoria?.item.id, descripcion: texto.slice(seg.inicio, seg.fin).trim() }
        : {
            fecha: fechaFinal, monto: monto?.valor, descripcion: texto.slice(seg.inicio, seg.fin).trim().replace(/[.\s]+$/, ''),
            entidadPagadoraId: pagadora,
            cuentaOrigenId: tipo === 'ingreso' || tipo === 'desembolso_credito' ? undefined : cuentaPrincipal?.id,
            cuentaDestinoId: tipo === 'ingreso' || tipo === 'desembolso_credito' ? cuentaPrincipal?.id : ctaDestino?.cuenta?.id,
            asignaciones: duena ? [{ entidadId: duena, proyectoId: proyecto && proyecto.item.entidadId === duena ? proyecto.item.id : undefined, monto: monto?.valor ?? 0 }] : [],
            categoriaId: categoria?.item.id ?? (tipo === 'pago_credito' ? 'cat-financiero' : undefined),
            terceroId: tercero?.item.id, creditoId: credito?.id,
          },
    }
    out.push(p)
  }

  if (out.length === 0) out.push(propuestaVacia(recibido, 'No se encontraron registros en el contenido'))
  return out
}

export function propuestaVacia(recibido: string, nota = 'La IA no reconoció este archivo. Completa los campos.'): Propuesta {
  return { id: nuevoId(), tipo: 'gasto', confianza: 15, evidencia: [], estado: 'pendiente', nota, campos: { fecha: recibido.slice(0, 10), asignaciones: [] } }
}

/** Chat exportado de WhatsApp: "dd/mm/aa, h:mm a. m. - Nombre: mensaje". Cada mensaje usa su propia fecha. */
export function extraerChatWhatsApp(texto: string, cfg: ConfigIA): Propuesta[] {
  const out: Propuesta[] = []
  const re = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s[^-\n]+-\s[^:\n]+:\s(.*)$/gm
  for (const m of texto.matchAll(re)) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3]
    const fecha = `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
    const msg = m[4]
    const off = m.index! + m[0].length - msg.length
    const ps = extraerPropuestas(msg, fecha, cfg, { offset: off })
    out.push(...ps.filter((p) => p.confianza > 15))
  }
  return out.length ? out : [propuestaVacia(new Date().toISOString())]
}

/** Extracto bancario: filas "dd/mm/aaaa  DESCRIPCIÓN  ±valor". */
export function extraerExtracto(texto: string, cuentaId: string, cfg: ConfigIA): Propuesta[] {
  const cuenta = cfg.cuentas.find((c) => c.id === cuentaId)!
  const out: Propuesta[] = []
  for (const m of texto.matchAll(/^(\d{2})\/(\d{2})\/(\d{4})\s+(.+?)\s+([+-])\$?\s?([\d.]+)$/gm)) {
    const fecha = `${m[3]}-${m[2]}-${m[1]}`
    const desc = m[4].trim()
    const valor = Number(m[6].replace(/\./g, ''))
    const entrada = m[5] === '+'
    const nd = normalizar(desc)
    const i0 = m.index!
    const ev: Evidencia[] = [
      { campo: 'fecha', textoFuente: m[0].slice(0, 10), inicio: i0, fin: i0 + 10 },
      { campo: 'monto', textoFuente: m[5] + m[6], inicio: i0 + m[0].length - m[6].length - 1, fin: i0 + m[0].length },
    ]
    const dIni = i0 + m[0].indexOf(m[4])
    ev.push({ campo: 'descripcion', textoFuente: desc, inicio: dIni, fin: dIni + desc.length })
    const otraEnt = cfg.entidades.find((e) => e.alias.some((a) => nd.includes(normalizar(a)) || nd.includes(normalizar(a).replace('empresa', 'emp'))))
    const cat = /gmf|4x1000|comision|cuota de manejo/.test(nd) ? 'cat-financiero' : /consignacion|venta|pago cliente/.test(nd) ? 'cat-ventas' : undefined
    const tipo: TipoHecho = otraEnt && otraEnt.id !== cuenta.entidadId ? 'pago_intercompania' : entrada ? 'ingreso' : cat === 'cat-financiero' ? 'interes' : 'gasto'
    const credito = cfg.creditos.find((c) => c.cuentaId === cuentaId && /leasing|credito|cuota/.test(nd))
    out.push({
      id: nuevoId(), tipo: credito ? 'pago_credito' : tipo, confianza: cat || otraEnt || credito ? 88 : 70, evidencia: ev, estado: 'pendiente',
      nota: !cat && !otraEnt && !credito ? 'Falta clasificar la categoría' : undefined,
      campos: {
        fecha, monto: valor, descripcion: desc, categoriaId: credito ? 'cat-financiero' : cat, creditoId: credito?.id,
        entidadPagadoraId: tipo === 'pago_intercompania' && entrada ? otraEnt!.id : cuenta.entidadId,
        cuentaOrigenId: entrada ? (tipo === 'pago_intercompania' ? cfg.cuentas.find((c) => c.entidadId === otraEnt!.id)?.id : undefined) : cuentaId,
        cuentaDestinoId: entrada ? cuentaId : undefined,
        asignaciones: [{ entidadId: tipo === 'pago_intercompania' && entrada ? cuenta.entidadId : cuenta.entidadId, monto: valor }],
      },
    })
  }
  return out
}
