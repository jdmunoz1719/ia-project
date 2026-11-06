import { diasEntre } from '@/domain/agenda'
import { deudaEntre, expandirHecho, matrizIntercompania } from '@/domain/libro'
import type { CamposPropuesta, Hecho, LineaLibro, Soporte, TipoHecho } from '@/domain/tipos'
import { formatCOP } from '@/lib/format'
import {
  ahora, demora, exigir, exigirMesAbierto, get, hechoVisible, lineasVisibles, mesBloqueado, nombreCuenta,
  nombreEntidad, registrar, set, uid, visibles,
} from './base'

export const NOMBRE_TIPO: Record<TipoHecho | 'tarea', string> = {
  ingreso: 'Ingreso', costo: 'Costo', gasto: 'Gasto', interes: 'Interés / cargo', inversion_proyecto: 'Inversión en proyecto',
  traslado: 'Traslado', pago_intercompania: 'Pago entre empresas', desembolso_credito: 'Desembolso de crédito',
  pago_credito: 'Pago de crédito', tarea: 'Tarea',
}

const ENTRADAS: TipoHecho[] = ['ingreso', 'desembolso_credito']
const DOS_CUENTAS: TipoHecho[] = ['traslado', 'pago_intercompania']

/** Valida y completa los campos de un hecho. Devuelve los errores en español. */
export function validarCampos(tipo: TipoHecho, c: CamposPropuesta): { hecho?: Omit<Hecho, 'id' | 'aprobadoPor' | 'aprobadoEn' | 'soporteIds'>; errores: string[] } {
  const e: string[] = []
  const s = get()
  if (!c.monto || c.monto <= 0) e.push('Falta el monto')
  if (!c.fecha) e.push('Falta la fecha')
  const cuentaMov = ENTRADAS.includes(tipo) ? c.cuentaDestinoId : c.cuentaOrigenId
  const pagadora = (cuentaMov && s.cuentas.find((x) => x.id === cuentaMov)?.entidadId) || c.entidadPagadoraId
  if (!pagadora) e.push('Falta la cuenta o la empresa que paga')
  if (DOS_CUENTAS.includes(tipo) && (!c.cuentaOrigenId || !c.cuentaDestinoId)) e.push('Indica la cuenta de origen y la de destino')
  let asignaciones = (c.asignaciones ?? []).filter((a) => a.entidadId)
  if (DOS_CUENTAS.includes(tipo)) {
    const dest = s.cuentas.find((x) => x.id === c.cuentaDestinoId)?.entidadId
    asignaciones = dest ? [{ entidadId: dest, monto: c.monto ?? 0 }] : asignaciones
  }
  if (!asignaciones.length) e.push('Indica a qué empresa pertenece')
  if (asignaciones.length === 1) asignaciones = [{ ...asignaciones[0], monto: c.monto ?? 0 }]
  const sumaAsig = asignaciones.reduce((x, a) => x + a.monto, 0)
  if (asignaciones.length > 1 && sumaAsig !== c.monto) e.push(`El reparto suma ${formatCOP(sumaAsig)} y el monto es ${formatCOP(c.monto ?? 0)}`)
  if (tipo === 'pago_credito' && c.desglosePagoCredito) {
    const d = c.desglosePagoCredito
    if (d.capital + d.interes + d.cargos !== c.monto) e.push('Capital + interés + cargos debe ser igual al monto')
  }
  if (e.length) return { errores: e }
  return {
    errores: [],
    hecho: {
      tipo, fecha: c.fecha!, monto: c.monto!, descripcion: c.descripcion?.trim() || NOMBRE_TIPO[tipo],
      cuentaOrigenId: ENTRADAS.includes(tipo) ? undefined : c.cuentaOrigenId,
      cuentaDestinoId: ENTRADAS.includes(tipo) || DOS_CUENTAS.includes(tipo) ? c.cuentaDestinoId : undefined,
      entidadPagadoraId: pagadora!, asignaciones,
      categoriaId: c.categoriaId, terceroId: c.terceroId, creditoId: c.creditoId, numeroCuota: c.numeroCuota,
      desglosePagoCredito: c.desglosePagoCredito, origenBandejaId: c.origenBandejaId,
    },
  }
}

/** Registra un hecho UNA sola vez y actualiza lo que dependa de él (créditos, obligaciones). */
export function crearHecho(tipo: TipoHecho, campos: CamposPropuesta, soporteIds: string[] = []): Hecho {
  exigir('aprobar')
  const { hecho, errores } = validarCampos(tipo, campos)
  if (!hecho) throw new Error(errores.join(' · '))
  exigirMesAbierto(hecho)
  const h: Hecho = { ...hecho, id: uid('h'), soporteIds, aprobadoPor: get().sesion.usuario?.nombre ?? 'Administrador', aprobadoEn: ahora() }

  set((s) => {
    const cambios: Partial<typeof s> = { hechos: [...s.hechos, h].sort((a, b) => a.fecha.localeCompare(b.fecha)) }
    // Pago de crédito: queda en el historial de pagos del crédito.
    if (h.tipo === 'pago_credito' && h.creditoId) {
      const d = h.desglosePagoCredito ?? { capital: h.monto, interes: 0, cargos: 0 }
      cambios.creditos = s.creditos.map((cr) => cr.id !== h.creditoId ? cr : { ...cr, pagos: [...cr.pagos, { hechoId: h.id, numeroCuota: h.numeroCuota ?? 0, ...d, fecha: h.fecha }] })
    }
    // Obligación que coincide (misma empresa y categoría, ±10 días): queda cumplida.
    const ent = h.asignaciones[0]?.entidadId
    cambios.obligaciones = s.obligaciones.map((o) => {
      if (o.entidadId !== ent || !h.categoriaId || o.categoriaId !== h.categoriaId) return o
      if (o.cumplidas.some((x) => Math.abs(diasEntre(x.periodo, h.fecha)) <= 10)) return o
      return { ...o, cumplidas: [...o.cumplidas, { periodo: h.fecha, hechoId: h.id, fecha: h.fecha }] }
    })
    return cambios
  })
  registrar('Aprobó movimiento', `${NOMBRE_TIPO[h.tipo]} ${formatCOP(h.monto)}`, `${h.descripcion} · ${nombreEntidad(h.asignaciones[0]?.entidadId)}`, h.origenBandejaId)
  return h
}

/** Frases legibles del efecto contable (vista previa antes de aprobar). */
export function describirEfecto(tipo: TipoHecho, campos: CamposPropuesta): { frases: { texto: string; tono: 'neutro' | 'ic' | 'salida' | 'entrada' }[]; lineas: LineaLibro[]; errores: string[] } {
  const { hecho, errores } = validarCampos(tipo, campos)
  if (!hecho) return { frases: [], lineas: [], errores }
  const ls = expandirHecho({ ...hecho, id: 'previa', soporteIds: [], aprobadoPor: '', aprobadoEn: '' }, get().cuentas)
  const F: { texto: string; tono: 'neutro' | 'ic' | 'salida' | 'entrada' }[] = []
  for (const l of ls) {
    const e = nombreEntidad(l.entidadId)
    if (l.concepto === 'resultado') F.push({ texto: l.monto < 0 ? `${l.claseResultado === 'financiero' ? 'Gasto financiero' : tipo === 'costo' ? 'Costo' : 'Gasto'} en ${e}${l.monto !== -hecho.monto ? ` (${formatCOP(-l.monto)})` : ''}` : `Ingreso en ${e}`, tono: 'neutro' })
    if (l.concepto === 'caja') F.push({ texto: `${l.monto < 0 ? 'Sale de' : 'Entra a'} ${nombreCuenta(l.cuentaId)} (${e})`, tono: l.monto < 0 ? 'salida' : 'entrada' })
    if (l.concepto === 'inversion') F.push({ texto: `Inversión en proyecto de ${e} (no es gasto)`, tono: 'neutro' })
    if (l.concepto === 'credito') F.push({ texto: l.monto > 0 ? `Sube la deuda del crédito de ${e}` : `Baja la deuda del crédito de ${e} en ${formatCOP(-l.monto)}`, tono: 'neutro' })
    if (l.concepto === 'por_pagar_ic') {
      F.push(l.monto > 0
        ? { texto: `${e} quedará debiendo ${formatCOP(l.monto)} a ${nombreEntidad(l.contraparteId)}`, tono: 'ic' }
        : { texto: `${e} abona ${formatCOP(-l.monto)} a lo que le debe a ${nombreEntidad(l.contraparteId)}`, tono: 'ic' })
    }
  }
  return { frases: F, lineas: ls, errores: [] }
}

export type FiltrosMovimientos = {
  entidadId?: string; proyectoId?: string; cuentaId?: string; tipo?: TipoHecho; desde?: string; hasta?: string
  sinSoporte?: boolean; ids?: string[]; texto?: string
}
export type FilaMovimiento = Hecho & { bloqueado: boolean; intercompania: boolean }

export const movimientos = {
  listar: (f: FiltrosMovimientos = {}) => demora((): FilaMovimiento[] => {
    const v = visibles()
    const ids = f.ids && new Set(f.ids)
    const q = f.texto?.toLowerCase()
    return get().hechos.filter((h) => hechoVisible(h, v)
      && (!ids || ids.has(h.id))
      && (!f.entidadId || h.entidadPagadoraId === f.entidadId || h.asignaciones.some((a) => a.entidadId === f.entidadId))
      && (!f.proyectoId || h.asignaciones.some((a) => a.proyectoId === f.proyectoId))
      && (!f.cuentaId || h.cuentaOrigenId === f.cuentaId || h.cuentaDestinoId === f.cuentaId)
      && (!f.tipo || h.tipo === f.tipo)
      && (!f.desde || h.fecha >= f.desde) && (!f.hasta || h.fecha <= f.hasta)
      && (!f.sinSoporte || h.soporteIds.length === 0)
      && (!q || h.descripcion.toLowerCase().includes(q)))
      .map((h) => ({ ...h, bloqueado: mesBloqueado(h), intercompania: h.asignaciones.some((a) => a.entidadId !== h.entidadPagadoraId) }))
      .reverse()
  }),

  detalle: (id: string) => demora(() => {
    const s = get()
    const h = s.hechos.find((x) => x.id === id)
    if (!h) throw new Error('Movimiento no encontrado')
    return {
      hecho: h, bloqueado: mesBloqueado(h),
      lineas: expandirHecho(h, s.cuentas),
      soportes: h.soporteIds.map((sid) => s.soportes.find((x) => x.id === sid)).filter(Boolean) as Soporte[],
      itemBandeja: s.bandeja.find((b) => b.propuestas.some((p) => p.hechoId === h.id)),
    }
  }),

  actualizar: (id: string, cambios: Pick<Hecho, 'descripcion'> & Partial<Pick<Hecho, 'categoriaId' | 'terceroId' | 'fecha'>>) => demora(() => {
    exigir('editar')
    const h = get().hechos.find((x) => x.id === id)!
    exigirMesAbierto(h)
    if (cambios.fecha) exigirMesAbierto({ ...h, fecha: cambios.fecha })
    set((s) => ({ hechos: s.hechos.map((x) => (x.id === id ? { ...x, ...cambios } : x)) }))
    registrar('Editó movimiento', h.descripcion, Object.keys(cambios).join(', '))
  }),

  adjuntarSoporte: (id: string, archivo: { nombre: string; tipoMime: string; tamano: number; url?: string }) => demora(() => {
    exigir('cargar')
    const sop: Soporte = { id: uid('s'), nombre: archivo.nombre, tipoMime: archivo.tipoMime, tamano: archivo.tamano, urlMock: archivo.url ?? '', recibidoEn: ahora(), canal: 'manual', hash: uid('hash') }
    set((s) => ({ soportes: [...s.soportes, sop], hechos: s.hechos.map((h) => (h.id === id ? { ...h, soporteIds: [...h.soporteIds, sop.id] } : h)) }))
    registrar('Adjuntó soporte', archivo.nombre)
  }),

  soporte: (id: string) => demora(() => get().soportes.find((s) => s.id === id)),
}

export const intercompanias = {
  matriz: () => demora(() => {
    const ents = get().entidades.filter((e) => visibles().has(e.id))
    const ls = lineasVisibles()
    const m = matrizIntercompania(ls, ents.map((e) => e.id))
    const total = Object.values(m).reduce((s, fila) => s + Object.values(fila).reduce((a, b) => a + b, 0), 0)
    return { entidades: ents, matriz: m, total }
  }),

  detalle: (deudor: string, acreedor: string) => demora(() => {
    const { valor, lineas } = deudaEntre(lineasVisibles(), deudor, acreedor)
    const hechos = get().hechos
    const filas = lineas.map((l) => ({ linea: l, hecho: hechos.find((h) => h.id === l.hechoId)!, efecto: l.entidadId === deudor ? l.monto : -l.monto }))
    return { valor, filas }
  }),

  registrarDevolucion: (p: { deudor: string; acreedor: string; monto: number; fecha: string; cuentaOrigenId: string; cuentaDestinoId: string; descripcion?: string }) => demora(() =>
    crearHecho('pago_intercompania', {
      fecha: p.fecha, monto: p.monto, cuentaOrigenId: p.cuentaOrigenId, cuentaDestinoId: p.cuentaDestinoId, entidadPagadoraId: p.deudor,
      descripcion: p.descripcion || `Devolución de ${nombreEntidad(p.deudor)} a ${nombreEntidad(p.acreedor)}`,
      asignaciones: [{ entidadId: p.acreedor, monto: p.monto }],
    })),
}
