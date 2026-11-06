import { format, parseISO, subMonths } from 'date-fns'
import { calcularAlertas, vencimientos, sumarDias } from '@/domain/agenda'
import { estadoCredito } from '@/domain/amortizacion'
import { calcularIndicadores, resumenPorEntidad, serieMensual } from '@/domain/indicadores'
import { type Alcance, deudaEntre, enRango, saldoCuenta } from '@/domain/libro'
import type { LineaLibro } from '@/domain/tipos'
import { formatCOP, formatFecha, formatMes } from '@/lib/format'
import { normalizar } from '@/services/ia/extractor'
import { contexto, demora, get, hechoVisible, lineasVisibles, nombreEntidad, pendientes, registrar, set, visibles } from './base'
import { NOMBRE_TIPO } from './movimientos'

const hechoIds = (ls: LineaLibro[]) => [...new Set(ls.map((l) => l.hechoId))]
const finDeMes = (ym: string) => format(new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0), 'yyyy-MM-dd')
export const ultimosMeses = (hoy: string, n = 6) => Array.from({ length: n }, (_, i) => format(subMonths(parseISO(hoy), n - 1 - i), 'yyyy-MM'))

function alertasActuales() {
  const s = get(); const v = visibles()
  return calcularAlertas({
    hoy: s.hoy, creditos: s.creditos.filter((c) => v.has(c.entidadId)), obligaciones: s.obligaciones.filter((o) => v.has(o.entidadId)),
    tareas: s.tareas.filter((t) => !t.entidadId || v.has(t.entidadId)), hechos: s.hechos.filter((h) => hechoVisible(h, v)),
    pospuestas: s.pospuestas, nombreEntidad,
  })
}

export const tableros = {
  indicadores: (alcance: Alcance, desde?: string, hasta?: string) => demora(() => calcularIndicadores(lineasVisibles(), alcance, contexto(), desde, hasta)),
  serie: (alcance: Alcance) => demora(() => serieMensual(lineasVisibles(), alcance, contexto(), ultimosMeses(get().hoy))),
  porEntidad: (desde?: string, hasta?: string) => demora(() => resumenPorEntidad(lineasVisibles(), contexto(), desde, hasta)),
  calidad: () => demora(() => {
    const s = get(); const v = visibles()
    const hechos = s.hechos.filter((h) => hechoVisible(h, v))
    const mesAnterior = format(subMonths(parseISO(s.hoy), 1), 'yyyy-MM')
    const sinConciliar = s.cuentas.filter((c) => v.has(c.entidadId) && !s.cierres.some((x) => x.cuentaId === c.id && x.mes === mesAnterior && x.estado === 'publicado'))
    const dups = s.bandeja.flatMap((b) => b.propuestas.filter((p) => p.estado === 'pendiente' && (p.posibleDuplicadoDe || b.archivoDuplicadoDe)).map((p) => ({ itemId: b.id, propuesta: p })))
    return {
      pendientes: pendientes().length,
      sinSoporte: hechos.filter((h) => h.soporteIds.length === 0).map((h) => h.id),
      cuentasSinConciliar: sinConciliar.map((c) => c.nombre), mesConciliacion: mesAnterior,
      duplicados: dups.length,
    }
  }),
}

export const inicio = {
  resumen: () => demora(() => {
    const s = get()
    const mes = s.hoy.slice(0, 7)
    const g: Alcance = { tipo: 'grupo', incluirPersonales: false }
    const disp = calcularIndicadores(lineasVisibles(), g, contexto(), undefined, s.hoy)
    const res = calcularIndicadores(lineasVisibles(), g, contexto(), `${mes}-01`, s.hoy)
    return {
      plata: disp.saldoCaja, resultadoMes: res.resultadoFinal, mes,
      pendientes: pendientes().length,
      itemsPendientes: s.bandeja.filter((b) => b.estado !== 'revisado').length,
      alertas: alertasActuales().length,
      alertasRojas: alertasActuales().filter((a) => a.nivel === 'rojo').length,
    }
  }),
  alertas: () => demora(alertasActuales),
  posponer: (alertaId: string, dias: number) => demora(() => {
    const hasta = sumarDias(get().hoy, dias)
    set((s) => ({ pospuestas: { ...s.pospuestas, [alertaId]: hasta } }))
    registrar('Pospuso alerta', alertaId, `Hasta ${formatFecha(hasta)}`)
  }, 100, 200),
  vencimientos: (dias = 30) => demora(() => {
    const s = get(); const v = visibles()
    return vencimientos({ hoy: s.hoy, dias, creditos: s.creditos.filter((c) => v.has(c.entidadId)), obligaciones: s.obligaciones.filter((o) => v.has(o.entidadId)), tareas: s.tareas.filter((t) => !t.entidadId || v.has(t.entidadId)), nombreEntidad })
  }),
}

// ---------------- Informes ----------------
export const informes = {
  informe: (alcance: Alcance, desde: string, hasta: string) => demora(() => {
    const s = get()
    const ctx = contexto()
    const ind = calcularIndicadores(lineasVisibles(), alcance, ctx, desde, hasta)
    const hechos = new Map(s.hechos.map((h) => [h.id, h]))
    const porCat = new Map<string, { valor: number; ids: Set<string> }>()
    for (const l of ind.resultadoFinal.lineas) {
      const cat = s.categorias.find((c) => c.id === hechos.get(l.hechoId)?.categoriaId)?.nombre ?? 'Sin categoría'
      const k = `${l.claseResultado}|${cat}`
      const x = porCat.get(k) ?? { valor: 0, ids: new Set() }
      x.valor += l.monto; x.ids.add(l.hechoId); porCat.set(k, x)
    }
    const categorias = [...porCat].map(([k, x]) => ({ clase: k.split('|')[0], categoria: k.split('|')[1], valor: x.valor, hechoIds: [...x.ids] }))
      .sort((a, b) => a.clase.localeCompare(b.clase) || Math.abs(b.valor) - Math.abs(a.valor))
    const cuentas = ctx.cuentas.filter((c) => alcance.tipo === 'grupo' ? (alcance.incluirPersonales || !s.entidades.find((e) => e.id === c.entidadId)?.esPersonal) : alcance.tipo === 'entidad' ? c.entidadId === alcance.entidadId : false)
      .map((c) => ({ cuenta: c, saldo: saldoCuenta(c, lineasVisibles(), hasta) }))
    return { indicadores: ind, categorias, cuentas, generado: s.hoy }
  }),

  paqueteContador: (entidadId: string, mes: string) => demora(() => {
    const s = get()
    const hs = s.hechos.filter((h) => h.fecha.startsWith(mes) && (h.entidadPagadoraId === entidadId || h.asignaciones.some((a) => a.entidadId === entidadId)))
    const n = (id?: string, arr: { id: string; nombre: string }[] = []) => arr.find((x) => x.id === id)?.nombre ?? ''
    const q = (v: string | number) => `"${String(v).replaceAll('"', '""')}"`
    const filas = [['Fecha', 'Tipo', 'Descripción', 'Monto', 'Empresa que paga', 'Empresa dueña', 'Proyecto', 'Cuenta', 'Categoría', 'Tercero', 'Soportes', 'Aprobado por'].map(q).join(';')]
    for (const h of hs) filas.push([
      formatFecha(h.fecha), NOMBRE_TIPO[h.tipo], h.descripcion, h.monto, nombreEntidad(h.entidadPagadoraId),
      h.asignaciones.map((a) => `${nombreEntidad(a.entidadId)} (${a.monto})`).join(' + '),
      h.asignaciones.map((a) => s.proyectos.find((p) => p.id === a.proyectoId)?.nombre).filter(Boolean).join(', '),
      s.cuentas.find((c) => c.id === (h.cuentaOrigenId ?? h.cuentaDestinoId))?.nombre ?? '',
      n(h.categoriaId, s.categorias), n(h.terceroId, s.terceros),
      h.soporteIds.map((id) => s.soportes.find((x) => x.id === id)?.nombre).join(' | ') || 'SIN SOPORTE', h.aprobadoPor,
    ].map(q).join(';'))
    registrar('Descargó paquete para el contador', `${nombreEntidad(entidadId)} · ${formatMes(mes)}`, `${hs.length} movimientos`)
    return {
      nombreArchivo: `paquete-contador-${nombreEntidad(entidadId).toLowerCase().replace(/\s+/g, '-')}-${mes}.csv`,
      csv: '﻿' + filas.join('\r\n'),
      movimientos: hs.length, sinSoporte: hs.filter((h) => !h.soporteIds.length).length,
      soportes: hs.flatMap((h) => h.soporteIds).length,
    }
  }),
}

// ---------------- Chat (sólo consulta; usa las mismas funciones del dominio) ----------------
export type RespuestaChat = { texto: string; cifra?: number; hechoIds?: string[]; enlace?: { etiqueta: string; to: string } }
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export const PREGUNTAS_SUGERIDAS = [
  '¿Cuánto le debe la Empresa A a la Empresa B?',
  '¿Cuánto se gastó en nómina en octubre?',
  '¿Cuál es el saldo del crédito constructor?',
  '¿Cuánta plata hay disponible hoy?',
  '¿Cuál fue el resultado de la Empresa C en septiembre?',
  '¿Qué cuotas están vencidas?',
  '¿Cuántos movimientos no tienen soporte?',
  '¿Cuánto se ha invertido en la remodelación del local?',
]

function responder(pregunta: string): RespuestaChat {
  const s = get(); const q = normalizar(pregunta); const v = visibles()
  const ents = s.entidades.filter((e) => v.has(e.id))
  const entidadesEn = (t: string) => ents.map((e) => ({ e, i: [normalizar(e.nombre), ...e.alias.map(normalizar)].map((a) => t.indexOf(a)).filter((i) => i >= 0).sort((a, b) => a - b)[0] ?? -1 })).filter((x) => x.i >= 0).sort((a, b) => a.i - b.i).map((x) => x.e)
  const mesIdx = MESES.findIndex((m) => q.includes(m))
  const anio = q.match(/20\d\d/)?.[0] ?? s.hoy.slice(0, 4)
  const mes = mesIdx >= 0 ? `${anio}-${String(mesIdx + 1).padStart(2, '0')}` : undefined
  const rango = mes ? [`${mes}-01`, finDeMes(mes)] as const : [undefined, s.hoy] as const
  const ctx = contexto(); const ls = lineasVisibles()
  const NO = { texto: 'No tengo datos para responder eso. Prueba con una de las preguntas sugeridas.' }

  if (/debe/.test(q)) {
    const [a, b] = entidadesEn(q)
    if (!a || !b) return NO
    const d = deudaEntre(ls, a.id, b.id)
    const texto = d.valor > 0 ? `${a.nombre} le debe ${formatCOP(d.valor)} a ${b.nombre}.` : d.valor < 0 ? `${a.nombre} no le debe a ${b.nombre}. Al contrario: ${b.nombre} le debe ${formatCOP(-d.valor)} a ${a.nombre}.` : `${a.nombre} y ${b.nombre} están a paz y salvo.`
    return { texto, cifra: Math.abs(d.valor), hechoIds: hechoIds(d.lineas), enlace: { etiqueta: 'Ver en Entre empresas', to: '/entre-empresas' } }
  }
  const cred = s.creditos.find((c) => v.has(c.entidadId) && (q.includes(normalizar(c.nombre)) || q.includes(normalizar(c.nombre).replace(/^credito\s+/, ''))))
  if (cred && /saldo|debe|cuanto/.test(q)) {
    const e = estadoCredito(cred, s.hoy)
    return { texto: `El saldo real del ${cred.nombre.toLowerCase()} (${cred.banco}, ${nombreEntidad(cred.entidadId)}) es ${formatCOP(e.saldoReal)}. Según la tabla debería ser ${formatCOP(e.saldoTabla)}.${e.vencidas.length ? ` Tiene ${e.vencidas.length} cuota(s) vencida(s).` : ''}`, cifra: e.saldoReal, hechoIds: cred.pagos.map((p) => p.hechoId).filter(Boolean), enlace: { etiqueta: 'Ver crédito', to: `/creditos/${cred.id}` } }
  }
  if (/vencid/.test(q) && /cuota/.test(q)) {
    const venc = s.creditos.filter((c) => v.has(c.entidadId)).flatMap((c) => estadoCredito(c, s.hoy).vencidas.map((f) => `${c.nombre}: cuota ${f.numero} de ${formatCOP(f.total)}, venció el ${formatFecha(f.fecha)}`))
    return { texto: venc.length ? `Hay ${venc.length} cuota(s) vencida(s):\n• ${venc.join('\n• ')}` : 'No hay cuotas vencidas.', enlace: { etiqueta: 'Ver créditos', to: '/creditos' } }
  }
  if (/soporte/.test(q)) {
    const ids = s.hechos.filter((h) => hechoVisible(h, v) && !h.soporteIds.length).map((h) => h.id)
    return { texto: `${ids.length} movimientos aprobados no tienen soporte adjunto.`, cifra: ids.length, hechoIds: ids }
  }
  if (/plata|disponible|saldo/.test(q)) {
    const e = entidadesEn(q)[0]
    const al: Alcance = e ? { tipo: 'entidad', entidadId: e.id } : { tipo: 'grupo', incluirPersonales: false }
    const r = calcularIndicadores(ls, al, ctx, undefined, s.hoy)
    return { texto: `${e ? e.nombre : 'El grupo (sin asuntos personales)'} tiene ${formatCOP(r.saldoCaja.valor)} en caja y bancos al ${formatFecha(s.hoy)}.`, cifra: r.saldoCaja.valor, hechoIds: hechoIds(r.saldoCaja.lineas) }
  }
  const pry = s.proyectos.find((p) => v.has(p.entidadId) && [p.nombre, ...p.alias].some((a) => q.includes(normalizar(a))))
  if (pry && /invert|inversion/.test(q)) {
    const r = calcularIndicadores(ls, { tipo: 'proyecto', proyectoId: pry.id }, ctx, rango[0], rango[1])
    return { texto: `En el proyecto ${pry.nombre} se han invertido ${formatCOP(r.inversionProyectos.valor)}${mes ? ` en ${formatMes(mes)}` : ''}.`, cifra: r.inversionProyectos.valor, hechoIds: hechoIds(r.inversionProyectos.lineas) }
  }
  if (/resultado|utilidad|gane|ganancia/.test(q)) {
    const e = entidadesEn(q)[0]
    const al: Alcance = e ? { tipo: 'entidad', entidadId: e.id } : { tipo: 'grupo', incluirPersonales: false }
    const r = calcularIndicadores(ls, al, ctx, rango[0], rango[1])
    return { texto: `El resultado final de ${e?.nombre ?? 'el grupo'}${mes ? ` en ${formatMes(mes)}` : ' a la fecha'} es ${formatCOP(r.resultadoFinal.valor)} (ingresos ${formatCOP(r.ingresos.valor)}, base caja).`, cifra: r.resultadoFinal.valor, hechoIds: hechoIds(r.resultadoFinal.lineas) }
  }
  if (/gast|pag|cost|ingres|vend/.test(q)) {
    const cat = s.categorias.find((c) => [c.nombre, ...c.alias].some((a) => q.includes(normalizar(a))))
    if (!cat && !/ingres|vend/.test(q)) return NO
    const e = entidadesEn(q)[0]
    const ids = new Set(s.hechos.filter((h) => (cat ? h.categoriaId === cat.id : true)).map((h) => h.id))
    const al: Alcance = e ? { tipo: 'entidad', entidadId: e.id } : { tipo: 'grupo', incluirPersonales: true }
    const r = calcularIndicadores(ls, al, ctx, rango[0], rango[1])
    const base = cat ? r.resultadoFinal.lineas.filter((l) => ids.has(l.hechoId)) : r.ingresos.lineas
    if (!base.length) return { texto: `No tengo movimientos aprobados de ${cat?.nombre.toLowerCase() ?? 'ingresos'}${mes ? ` en ${formatMes(mes)}` : ''}.` }
    const total = Math.abs(base.reduce((x, l) => x + l.monto, 0))
    return { texto: `${cat ? `En ${cat.nombre.toLowerCase()} se ${cat.clase === 'ingreso' ? 'recibieron' : 'gastaron'}` : 'Los ingresos fueron'} ${formatCOP(total)}${mes ? ` en ${formatMes(mes)}` : ''}${e ? ` (${e.nombre})` : ''}, en ${hechoIds(base).length} movimientos.`, cifra: total, hechoIds: hechoIds(base) }
  }
  return NO
}

export const chat = {
  sugeridas: () => Promise.resolve(PREGUNTAS_SUGERIDAS),
  preguntar: (pregunta: string) => demora(() => responder(pregunta), 500, 1100),
}

// Para el rango del periodo en pantallas.
export const util = { finDeMes, enRango }
