import { format, parseISO, subMonths } from 'date-fns'
import { ocurrencias } from '@/domain/agenda'
import { estadoCredito, serieSaldos, tablaAmortizacion } from '@/domain/amortizacion'
import { saldoCuenta } from '@/domain/libro'
import type { Credito, Obligacion, Rol, Tarea } from '@/domain/tipos'
import { formatCOP, formatFecha, formatMes, formatPct } from '@/lib/format'
import { estadoInicial, useDemo, type EstadoDemo, type Usuario } from '@/store/demo'
import { demora, exigir, get, lineas, nombreEntidad, registrar, set, uid, visibles } from './base'
import { crearHecho } from './movimientos'

// ---------------- Créditos ----------------
export const creditos = {
  listar: () => demora(() => {
    const s = get(); const v = visibles()
    return s.creditos.filter((c) => v.has(c.entidadId)).map((c) => {
      const e = estadoCredito(c, s.hoy)
      return { credito: c, saldoReal: e.saldoReal, proxima: e.proxima, vencidas: e.vencidas.length, cuotaTotal: e.cuotaTotal, tasaMensual: e.tasaMensual, pagadas: e.filas.filter((f) => f.estado === 'pagada').length }
    })
  }),
  detalle: (id: string) => demora(() => {
    const s = get()
    const c = s.creditos.find((x) => x.id === id)
    if (!c) throw new Error('Crédito no encontrado')
    return { credito: c, ...estadoCredito(c, s.hoy), serie: serieSaldos(c, s.hoy), hoy: s.hoy }
  }),
  registrarPago: (id: string, p: { numeroCuota: number; fecha: string; capital: number; interes: number; cargos: number; cuentaId: string }) => demora(() => {
    const c = get().creditos.find((x) => x.id === id)!
    if (c.pagos.some((x) => x.numeroCuota === p.numeroCuota && p.numeroCuota > 0)) throw new Error(`La cuota ${p.numeroCuota} ya está pagada`)
    return crearHecho('pago_credito', {
      fecha: p.fecha, monto: p.capital + p.interes + p.cargos, cuentaOrigenId: p.cuentaId, descripcion: `Cuota ${p.numeroCuota} ${c.nombre.toLowerCase()}`,
      asignaciones: [{ entidadId: c.entidadId, monto: p.capital + p.interes + p.cargos }], creditoId: id, numeroCuota: p.numeroCuota,
      categoriaId: 'cat-financiero', desglosePagoCredito: { capital: p.capital, interes: p.interes, cargos: p.cargos },
    })
  }),
  registrarDesembolso: (id: string, p: { fecha: string; monto: number; cuentaId: string }) => demora(() => {
    const c = get().creditos.find((x) => x.id === id)!
    return crearHecho('desembolso_credito', { fecha: p.fecha, monto: p.monto, cuentaDestinoId: p.cuentaId, creditoId: id, descripcion: `Desembolso ${c.nombre.toLowerCase()}`, asignaciones: [{ entidadId: c.entidadId, monto: p.monto }] })
  }),
  cambiarCondiciones: (id: string, cb: { tipo: 'tasa' | 'abono_extra'; valor: number; fecha: string; nota: string; cuentaId?: string }) => demora(() => {
    exigir('editar')
    const c = get().creditos.find((x) => x.id === id)!
    if (cb.tipo === 'abono_extra') {
      crearHecho('pago_credito', { fecha: cb.fecha, monto: cb.valor, cuentaOrigenId: cb.cuentaId ?? c.cuentaId, descripcion: `Abono extraordinario a capital ${c.nombre.toLowerCase()}`, asignaciones: [{ entidadId: c.entidadId, monto: cb.valor }], creditoId: id, numeroCuota: 0, categoriaId: 'cat-financiero', desglosePagoCredito: { capital: cb.valor, interes: 0, cargos: 0 } })
    }
    set((s) => ({ creditos: s.creditos.map((x) => (x.id === id ? { ...x, cambios: [...x.cambios, cb] } : x)) }))
    registrar('Cambió condiciones del crédito', c.nombre, cb.tipo === 'tasa' ? `Nueva tasa ${formatPct(cb.valor, 2)} ${c.tasa.tipo} desde ${formatFecha(cb.fecha)}` : `Abono extra ${formatCOP(cb.valor)} el ${formatFecha(cb.fecha)}`)
  }),
  anotarSaldoBanco: (id: string, p: { fecha: string; saldo: number }) => demora(() => {
    exigir('editar')
    set((s) => ({ creditos: s.creditos.map((x) => (x.id === id ? { ...x, saldosBanco: [...x.saldosBanco, p] } : x)) }))
    registrar('Anotó saldo del banco', get().creditos.find((x) => x.id === id)!.nombre, `${formatCOP(p.saldo)} al ${formatFecha(p.fecha)}`)
  }),
  crear: (c: Omit<Credito, 'id' | 'pagos' | 'saldosBanco' | 'cambios'>) => demora(() => {
    exigir('editar')
    const nuevo: Credito = { ...c, id: uid('cred'), pagos: [], saldosBanco: [], cambios: [] }
    set((s) => ({ creditos: [...s.creditos, nuevo] }))
    registrar('Creó crédito', c.nombre, `${formatCOP(c.monto)} · ${c.numCuotas} cuotas`)
    return nuevo.id
  }),
  simular: (c: Pick<Credito, 'monto' | 'tasa' | 'numCuotas' | 'primeraFecha' | 'cargosPorCuota'>) => Promise.resolve(tablaAmortizacion(c)),
}

// ---------------- Cierres ----------------
export const cierres = {
  meses: () => demora(() => { const h = get().hoy; return Array.from({ length: 6 }, (_, i) => format(subMonths(parseISO(h), i), 'yyyy-MM')) }),
  listar: (mes: string) => demora(() => {
    const s = get(); const v = visibles()
    const fin = format(new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0), 'yyyy-MM-dd')
    return s.cuentas.filter((c) => v.has(c.entidadId)).map((c) => {
      const cierre = s.cierres.find((x) => x.cuentaId === c.id && x.mes === mes)
      const saldoSistema = cierre?.estado === 'publicado' ? cierre.saldoSistema : saldoCuenta(c, lineas(), fin)
      const ext = cierre?.saldoExtracto ?? null
      const diferencia = ext === null ? null : ext - saldoSistema
      const explicado = (cierre?.diferencias ?? []).reduce((a, d) => a + d.monto, 0)
      return { cuenta: c, cierre, saldoSistema, saldoExtracto: ext, diferencia, explicado, sinExplicar: diferencia === null ? null : diferencia - explicado, mesCerrado: fin < s.hoy }
    })
  }),
  guardar: (cuentaId: string, mes: string, saldoExtracto: number, diferencias: { monto: number; explicacion: string }[]) => demora(() => {
    exigir('editar')
    const c = get().cuentas.find((x) => x.id === cuentaId)!
    set((s) => {
      const existe = s.cierres.find((x) => x.cuentaId === cuentaId && x.mes === mes)
      if (existe?.estado === 'publicado') throw new Error('El cierre está publicado')
      const nuevo = { id: existe?.id ?? uid('cierre'), entidadId: c.entidadId, cuentaId, mes, saldoSistema: 0, saldoExtracto, diferencias, estado: 'abierto' as const, reaperturas: existe?.reaperturas ?? [] }
      return { cierres: existe ? s.cierres.map((x) => (x.id === existe.id ? { ...x, ...nuevo } : x)) : [...s.cierres, nuevo] }
    })
    registrar('Guardó saldo del extracto', `${c.nombre} · ${formatMes(mes)}`, formatCOP(saldoExtracto))
  }),
  publicar: (cuentaId: string, mes: string) => demora(() => {
    exigir('editar')
    const s = get()
    const c = s.cuentas.find((x) => x.id === cuentaId)!
    const fin = format(new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0), 'yyyy-MM-dd')
    const cierre = s.cierres.find((x) => x.cuentaId === cuentaId && x.mes === mes)
    if (!cierre || cierre.saldoExtracto === null) throw new Error('Ingresa primero el saldo del extracto')
    const saldoSistema = saldoCuenta(c, lineas(), fin)
    const sinExplicar = cierre.saldoExtracto - saldoSistema - cierre.diferencias.reduce((a, d) => a + d.monto, 0)
    if (sinExplicar !== 0) throw new Error(`Quedan ${formatCOP(sinExplicar)} sin explicar`)
    set((st) => ({ cierres: st.cierres.map((x) => (x.id === cierre.id ? { ...x, saldoSistema, estado: 'publicado', publicadoEn: `${st.hoy}T12:00:00` } : x)) }))
    registrar('Publicó cierre', `${c.nombre} · ${formatMes(mes)}`, `Saldo ${formatCOP(saldoSistema)} · mes bloqueado`)
  }),
  reabrir: (cuentaId: string, mes: string, motivo: string) => demora(() => {
    exigir('editar')
    if (motivo.trim().length < 10) throw new Error('Escribe un motivo de al menos 10 caracteres')
    const s = get()
    const usuario = s.sesion.usuario?.nombre ?? 'Administrador'
    set((st) => ({ cierres: st.cierres.map((x) => (x.cuentaId === cuentaId && x.mes === mes ? { ...x, estado: 'abierto', reaperturas: [...x.reaperturas, { fecha: `${st.hoy}T12:00:00`, motivo, usuario }] } : x)) }))
    registrar('Reabrió cierre', `${s.cuentas.find((c) => c.id === cuentaId)!.nombre} · ${formatMes(mes)}`, `Motivo: ${motivo}`)
  }),
}

// ---------------- Agenda ----------------
export const agenda = {
  ocurrencias: (desde: string, hasta: string) => demora(() => {
    const s = get(); const v = visibles()
    return ocurrencias(s.obligaciones.filter((o) => v.has(o.entidadId)), desde, hasta, s.hoy).map((o) => ({
      ...o, responsable: s.responsables.find((r) => r.id === o.obligacion.responsableId)?.nombre ?? '—',
    }))
  }),
  obligaciones: () => demora(() => get().obligaciones.filter((o) => visibles().has(o.entidadId))),
  registrarPago: (obligacionId: string, periodo: string, p: { fecha: string; monto: number; cuentaId: string }) => demora(() => {
    const o = get().obligaciones.find((x) => x.id === obligacionId)!
    const h = crearHecho('gasto', { fecha: p.fecha, monto: p.monto, cuentaOrigenId: p.cuentaId, descripcion: o.nombre, categoriaId: o.categoriaId, asignaciones: [{ entidadId: o.entidadId, monto: p.monto }] })
    set((s) => ({ obligaciones: s.obligaciones.map((x) => (x.id !== obligacionId ? x : { ...x, cumplidas: [...x.cumplidas.filter((c) => c.hechoId !== h.id), { periodo, hechoId: h.id, fecha: p.fecha }] })) }))
    registrar('Registró pago de obligación', o.nombre, `${formatCOP(p.monto)} · ${nombreEntidad(o.entidadId)}`)
  }),
  guardarObligacion: (o: Omit<Obligacion, 'id' | 'cumplidas'> & { id?: string }) => demora(() => {
    exigir('editar')
    set((s) => ({ obligaciones: o.id ? s.obligaciones.map((x) => (x.id === o.id ? { ...x, ...o } : x)) : [...s.obligaciones, { ...o, id: uid('ob'), cumplidas: [] }] }))
    registrar(o.id ? 'Editó obligación' : 'Creó obligación', o.nombre, formatCOP(o.valor))
  }),
  tareas: () => demora(() => get().tareas.filter((t) => !t.entidadId || visibles().has(t.entidadId)).sort((a, b) => a.vence.localeCompare(b.vence))),
  crearTarea: (t: Omit<Tarea, 'id' | 'hecha'>) => demora(() => {
    exigir('cargar')
    set((s) => ({ tareas: [...s.tareas, { ...t, id: uid('t'), hecha: false }] }))
    registrar('Creó tarea', t.titulo, `Vence ${formatFecha(t.vence)}`)
  }),
  marcarTarea: (id: string, hecha: boolean) => demora(() => {
    exigir('cargar')
    set((s) => ({ tareas: s.tareas.map((t) => (t.id === id ? { ...t, hecha } : t)) }))
    registrar(hecha ? 'Completó tarea' : 'Reabrió tarea', get().tareas.find((t) => t.id === id)!.titulo)
  }, 100, 250),
}

// ---------------- Configuración ----------------
type Coleccion = 'entidades' | 'cuentas' | 'proyectos' | 'categorias' | 'terceros' | 'responsables'
const NOMBRE_COL: Record<Coleccion, string> = { entidades: 'empresa', cuentas: 'cuenta', proyectos: 'proyecto', categorias: 'categoría', terceros: 'tercero', responsables: 'responsable' }

export const configuracion = {
  obtener: () => demora(() => {
    const s = get(); const v = visibles()
    return {
      entidades: s.entidades.filter((e) => v.has(e.id)), cuentas: s.cuentas.filter((c) => v.has(c.entidadId)),
      proyectos: s.proyectos.filter((p) => v.has(p.entidadId)), categorias: s.categorias, terceros: s.terceros, responsables: s.responsables,
      creditos: s.creditos.filter((c) => v.has(c.entidadId)).map(({ id, nombre, entidadId, banco, cuentaId }) => ({ id, nombre, entidadId, banco, cuentaId })),
    }
  }, 100, 250),
  guardar: <C extends Coleccion>(col: C, item: EstadoDemo[C][number]) => demora(() => {
    exigir('configurar')
    const existe = (get()[col] as { id: string }[]).some((x) => x.id === item.id)
    const conId = { ...item, id: item.id || uid(col.slice(0, 3)) }
    set((s) => ({ [col]: existe ? (s[col] as { id: string }[]).map((x) => (x.id === item.id ? conId : x)) : [...s[col], conId] }) as Partial<EstadoDemo>)
    registrar(existe ? `Editó ${NOMBRE_COL[col]}` : `Creó ${NOMBRE_COL[col]}`, (item as { nombre: string }).nombre)
  }),
  eliminar: (col: Coleccion, id: string) => demora(() => {
    exigir('configurar')
    const s = get()
    const usado = s.hechos.some((h) => [h.cuentaOrigenId, h.cuentaDestinoId, h.entidadPagadoraId, h.categoriaId, h.terceroId, ...h.asignaciones.flatMap((a) => [a.entidadId, a.proyectoId])].includes(id))
    if (usado) throw new Error(`No se puede eliminar: hay movimientos que usan esta ${NOMBRE_COL[col]}`)
    const nombre = (s[col] as { id: string; nombre: string }[]).find((x) => x.id === id)?.nombre ?? id
    set((st) => ({ [col]: (st[col] as { id: string }[]).filter((x) => x.id !== id) }) as Partial<EstadoDemo>)
    registrar(`Eliminó ${NOMBRE_COL[col]}`, nombre)
  }),
  historial: () => demora(() => [...get().historial].reverse()),
  cargaDrive: (alProgresar: (p: number, archivo: string) => void) => new Promise<{ encontrados: number; cargados: number; omitidos: number; fallidos: number; detalle: { carpeta: string; archivos: number }[] }>((ok) => {
    const archivos = ['Empresa A/2026/10/Facturas/factura-ferreteria-3381.pdf', 'Empresa A/2026/10/Recibos/recibo-arriendo.jpg', 'Empresa B/2026/10/Extractos/extracto-bancolombia.xlsx', 'Empresa C/2026/10/Contratos/acta-obra-12.pdf', 'Empresa D/2026/10/Facturas/factura-epm.pdf', 'Empresa E/2026/10/Recibos/canon-local-104.jpg', 'Asuntos personales/2026/10/Recibos/colegio.pdf']
    let i = 0
    const t = setInterval(() => {
      i++
      alProgresar(Math.min(100, Math.round((i / 40) * 100)), archivos[i % archivos.length])
      if (i >= 40) {
        clearInterval(t)
        const r = { encontrados: 147, cargados: 131, omitidos: 13, fallidos: 3, detalle: [{ carpeta: 'Empresa A', archivos: 38 }, { carpeta: 'Empresa B', archivos: 41 }, { carpeta: 'Empresa C', archivos: 29 }, { carpeta: 'Empresa D', archivos: 17 }, { carpeta: 'Empresa E', archivos: 12 }, { carpeta: 'Asuntos personales', archivos: 10 }] }
        registrar('Carga inicial desde Google Drive', 'Google Drive', `${r.encontrados} encontrados, ${r.cargados} cargados, ${r.omitidos} omitidos (duplicados), ${r.fallidos} fallidos`)
        ok(r)
      }
    }, 90)
  }),
}

// ---------------- Sesión (simulada: sin backend ni login real) ----------------
export const USUARIOS_DEMO: Usuario[] = [
  { nombre: 'Laura Restrepo', email: 'laura@grupo-demo.co', rol: 'administrador' },
  { nombre: 'Camila Ortiz', email: 'camila@grupo-demo.co', rol: 'asistente' },
  { nombre: 'Carlos Mejía', email: 'carlos@contador-demo.co', rol: 'contador', entidadIds: ['emp-a', 'emp-b'] },
]
export const CODIGO_2FA_DEMO = '246810'

export const sesion = {
  actual: () => Promise.resolve({ ...get().sesion, hoy: get().hoy }),
  iniciar: (email: string, clave: string) => demora(() => {
    const u = USUARIOS_DEMO.find((x) => x.email === email.trim().toLowerCase())
    if (!u || clave.length < 4) throw new Error('Correo o contraseña incorrectos')
    set(() => ({ sesion: { usuario: u, verificado: false } }))
    return u
  }, 400, 700),
  verificar: (codigo: string) => demora(() => {
    if (codigo !== CODIGO_2FA_DEMO) throw new Error('Código incorrecto')
    set((s) => ({ sesion: { ...s.sesion, verificado: true } }))
    registrar('Inició sesión', 'Sesión', 'Verificación en dos pasos')
  }, 400, 700),
  cerrar: () => demora(() => { registrar('Cerró sesión', 'Sesión'); set(() => ({ sesion: { usuario: null, verificado: false } })) }, 100, 200),
  cambiarRol: (rol: Rol) => demora(() => {
    const u = USUARIOS_DEMO.find((x) => x.rol === rol)!
    set(() => ({ sesion: { usuario: u, verificado: true } }))
    registrar('Cambió de usuario (demo)', u.nombre, rol)
  }, 100, 200),
  cambiarHoy: (fecha: string) => demora(() => { set(() => ({ hoy: fecha })); registrar('Cambió la fecha de la demo', formatFecha(fecha)) }, 100, 200),
  reiniciarDemo: () => demora(() => {
    const ses = get().sesion
    useDemo.setState({ ...estadoInicial(), sesion: ses })
  }, 300, 500),
}
