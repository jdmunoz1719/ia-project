// Datos semilla: mayo a octubre de 2026. Generación determinística (misma semilla = mismos datos).
import { tablaAmortizacion } from '@/domain/amortizacion'
import type {
  Categoria, Cierre, Credito, Cuenta, Entidad, EventoHistorial, Hecho, Obligacion, Proyecto,
  Responsable, Soporte, Tarea, Tercero, TipoHecho,
} from '@/domain/tipos'

export const HOY_DEMO = '2026-10-28'

export const entidades: Entidad[] = [
  { id: 'emp-a', nombre: 'Empresa A', alias: ['empresa a'], esPersonal: false, descripcion: 'Taller y bodega' },
  { id: 'emp-b', nombre: 'Empresa B', alias: ['empresa b'], esPersonal: false, descripcion: 'Comercial' },
  { id: 'emp-c', nombre: 'Empresa C', alias: ['empresa c', 'la constructora'], esPersonal: false, descripcion: 'Construcción' },
  { id: 'emp-d', nombre: 'Empresa D', alias: ['empresa d'], esPersonal: false, descripcion: 'Servicios' },
  { id: 'emp-e', nombre: 'Empresa E', alias: ['empresa e', 'la inmobiliaria'], esPersonal: false, descripcion: 'Inmobiliaria' },
  { id: 'personal', nombre: 'Asuntos personales', alias: ['personal', 'asuntos personales', 'lo personal', 'socios'], esPersonal: true, descripcion: 'Gastos de los socios' },
]

const INI = '2026-05-01'
export const cuentas: Cuenta[] = [
  { id: 'cta-bancob', entidadId: 'emp-a', banco: 'Banco B', nombre: 'Banco B · Corriente 4471', alias: ['banco b'], saldoInicial: 38_400_000, fechaSaldoInicial: INI },
  { id: 'cta-bancolombia', entidadId: 'emp-b', banco: 'Bancolombia', nombre: 'Bancolombia · Ahorros 2093', alias: ['bancolombia'], saldoInicial: 52_750_000, fechaSaldoInicial: INI },
  { id: 'cta-davivienda', entidadId: 'emp-c', banco: 'Davivienda', nombre: 'Davivienda · Corriente 8810', alias: ['davivienda'], saldoInicial: 26_300_000, fechaSaldoInicial: INI },
  { id: 'cta-bogota', entidadId: 'emp-d', banco: 'Banco de Bogotá', nombre: 'Banco de Bogotá · Ahorros 1156', alias: ['banco de bogotá', 'banco de bogota', 'bogotá'], saldoInicial: 19_200_000, fechaSaldoInicial: INI },
  { id: 'cta-caja-e', entidadId: 'emp-e', banco: 'Caja', nombre: 'Caja general E', alias: ['caja de la e', 'caja e'], saldoInicial: 14_500_000, fechaSaldoInicial: INI },
  { id: 'cta-efectivo', entidadId: 'personal', banco: 'Efectivo', nombre: 'Efectivo socios', alias: ['efectivo', 'plata personal'], saldoInicial: 9_800_000, fechaSaldoInicial: INI },
]

export const proyectos: Proyecto[] = [
  { id: 'pry-taller', entidadId: 'emp-a', nombre: 'Taller', alias: ['taller', 'el taller'] },
  { id: 'pry-bodega', entidadId: 'emp-a', nombre: 'Bodega', alias: ['bodega', 'la bodega'] },
  { id: 'pry-laureles', entidadId: 'emp-c', nombre: 'Obra Laureles', alias: ['laureles', 'obra laureles', 'la obra'] },
  { id: 'pry-local', entidadId: 'emp-e', nombre: 'Remodelación local', alias: ['remodelación', 'remodelacion', 'el local'] },
]

export const categorias: Categoria[] = [
  { id: 'cat-ventas', nombre: 'Ventas', clase: 'ingreso', alias: ['venta', 'ventas', 'factura'] },
  { id: 'cat-servicios-prest', nombre: 'Servicios prestados', clase: 'ingreso', alias: ['servicio prestado', 'honorarios recibidos'] },
  { id: 'cat-arriendos-rec', nombre: 'Arriendos recibidos', clase: 'ingreso', alias: ['canon', 'arriendo recibido'] },
  { id: 'cat-anticipo', nombre: 'Anticipos de obra', clase: 'ingreso', alias: ['anticipo', 'acta de obra'] },
  { id: 'cat-materiales', nombre: 'Materiales', clase: 'costo_venta', alias: ['materiales', 'material', 'insumos'] },
  { id: 'cat-mercancia', nombre: 'Mercancía', clase: 'costo_venta', alias: ['mercancía', 'mercancia', 'inventario'] },
  { id: 'cat-contratistas', nombre: 'Mano de obra contratada', clase: 'costo_venta', alias: ['contratista', 'mano de obra'] },
  { id: 'cat-nomina', nombre: 'Nómina', clase: 'gasto_operativo', alias: ['nómina', 'nomina', 'sueldos', 'quincena'] },
  { id: 'cat-arriendo', nombre: 'Arriendo', clase: 'gasto_operativo', alias: ['arriendo', 'arrendamiento', 'canon de arriendo'] },
  { id: 'cat-servicios', nombre: 'Servicios públicos', clase: 'gasto_operativo', alias: ['servicios', 'luz', 'agua', 'energía', 'epm', 'internet'] },
  { id: 'cat-iva', nombre: 'IVA', clase: 'gasto_operativo', alias: ['iva'] },
  { id: 'cat-honorarios', nombre: 'Honorarios', clase: 'gasto_operativo', alias: ['contador', 'honorarios', 'revisoría', 'abogado'] },
  { id: 'cat-transporte', nombre: 'Transporte', clase: 'gasto_operativo', alias: ['transporte', 'flete', 'gasolina', 'peajes'] },
  { id: 'cat-mantenimiento', nombre: 'Mantenimiento', clase: 'gasto_operativo', alias: ['mantenimiento', 'reparación', 'arreglo'] },
  { id: 'cat-administracion', nombre: 'Administración copropiedad', clase: 'gasto_operativo', alias: ['administración', 'administracion'] },
  { id: 'cat-personales', nombre: 'Gastos personales', clase: 'gasto_operativo', alias: ['colegio', 'mercado', 'medicina prepagada', 'tarjeta'] },
  { id: 'cat-financiero', nombre: 'Intereses y cargos', clase: 'financiero', alias: ['intereses', 'cuota', 'seguro del crédito'] },
  { id: 'cat-inversion', nombre: 'Inversión en proyecto', clase: 'inversion', alias: ['adecuación', 'obra', 'remodelación'] },
]

export const terceros: Tercero[] = [
  { id: 'ter-rios', nombre: 'Inversiones Ríos S.A.S.', alias: ['inversiones ríos', 'don jaime', 'arrendador de la bodega'] },
  { id: 'ter-inmolaureles', nombre: 'Inmobiliaria Laureles', alias: ['inmobiliaria laureles'] },
  { id: 'ter-epm', nombre: 'EPM', alias: ['epm', 'empresas públicas'] },
  { id: 'ter-dian', nombre: 'DIAN', alias: ['dian'] },
  { id: 'ter-tornillo', nombre: 'Ferretería El Tornillo', alias: ['ferretería el tornillo', 'el tornillo', 'la ferretería'] },
  { id: 'ter-concretos', nombre: 'Concretos del Valle S.A.', alias: ['concretos del valle', 'concretos'] },
  { id: 'ter-horizonte', nombre: 'Constructora Horizonte S.A.S.', alias: ['constructora horizonte', 'horizonte'] },
  { id: 'ter-nova', nombre: 'Comercializadora Nova', alias: ['comercializadora nova', 'nova'] },
  { id: 'ter-rapido', nombre: 'Transportes Rápido Sur', alias: ['rápido sur', 'rapido sur'] },
  { id: 'ter-andina', nombre: 'Distribuidora Andina', alias: ['distribuidora andina', 'andina'] },
  { id: 'ter-contador', nombre: 'Carlos Mejía Contador', alias: ['carlos', 'el contador'] },
  { id: 'ter-arquitecta', nombre: 'Arq. Paula Henao', alias: ['paula', 'la arquitecta'] },
  { id: 'ter-clientes', nombre: 'Clientes varios', alias: ['cliente', 'clientes'] },
]

export const responsables: Responsable[] = [
  { id: 'res-laura', nombre: 'Laura Restrepo', cargo: 'Administradora' },
  { id: 'res-andres', nombre: 'Andrés Gómez', cargo: 'Socio' },
  { id: 'res-camila', nombre: 'Camila Ortiz', cargo: 'Asistente administrativa' },
  { id: 'res-carlos', nombre: 'Carlos Mejía', cargo: 'Contador' },
]

// ---------------- Generación de movimientos ----------------
function prng(semilla: number) {
  let a = semilla
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function generarSemilla() {
  const r = prng(20261028)
  const entre = (min: number, max: number, paso = 10_000) => Math.round((min + r() * (max - min)) / paso) * paso
  const meses = ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']
  const hechos: Hecho[] = []
  const soportes: Soporte[] = []
  let n = 0

  const cuentaDe = (ent: string) => cuentas.find((c) => c.entidadId === ent)!.id
  const dia = (mes: string, d: number) => `${mes}-${String(Math.min(d, mes === '2026-10' ? 26 : 30)).padStart(2, '0')}`

  type Nuevo = {
    tipo: TipoHecho; fecha: string; monto: number; descripcion: string; ent: string
    pagador?: string; asign?: { entidadId: string; proyectoId?: string; monto: number }[]
    categoriaId?: string; terceroId?: string; proyectoId?: string; cuentaDestinoId?: string; cuentaOrigenId?: string
    creditoId?: string; numeroCuota?: number; desglose?: Hecho['desglosePagoCredito']; sinSoporte?: boolean
  }
  const add = (x: Nuevo) => {
    const id = `h-${String(++n).padStart(4, '0')}`
    const pagador = x.pagador ?? x.ent
    const entrada = x.tipo === 'ingreso' || x.tipo === 'desembolso_credito'
    const soporteIds: string[] = []
    // ~12 % sin soporte
    if (!x.sinSoporte && r() > 0.12) {
      const esFoto = r() > 0.55
      const s: Soporte = {
        id: `s-${id}`, nombre: `${esFoto ? 'foto' : 'comprobante'}-${x.fecha.replaceAll('-', '')}-${n}.${esFoto ? 'jpg' : 'pdf'}`,
        tipoMime: esFoto ? 'image/jpeg' : 'application/pdf', tamano: Math.round(80_000 + r() * 900_000),
        urlMock: esFoto ? '/demo/recibo-arriendo-bodega.jpg' : '/demo/factura-servicios.pdf',
        recibidoEn: `${x.fecha}T${String(8 + Math.floor(r() * 10)).padStart(2, '0')}:${String(Math.floor(r() * 60)).padStart(2, '0')}:00`,
        canal: (['whatsapp', 'manual', 'correo', 'drive'] as const)[Math.floor(r() * 4)], hash: `seed-${n}`,
        contenidoTexto: `${x.descripcion} — ${x.monto.toLocaleString('es-CO')}`,
      }
      soportes.push(s); soporteIds.push(s.id)
    }
    const h: Hecho = {
      id, tipo: x.tipo, fecha: x.fecha, monto: x.monto, descripcion: x.descripcion,
      entidadPagadoraId: pagador,
      cuentaOrigenId: x.cuentaOrigenId ?? (entrada ? undefined : cuentaDe(pagador)),
      cuentaDestinoId: x.cuentaDestinoId ?? (entrada ? cuentaDe(pagador) : undefined),
      asignaciones: x.asign ?? [{ entidadId: x.ent, proyectoId: x.proyectoId, monto: x.monto }],
      categoriaId: x.categoriaId, terceroId: x.terceroId, creditoId: x.creditoId, numeroCuota: x.numeroCuota,
      desglosePagoCredito: x.desglose, soporteIds, aprobadoPor: 'Laura Restrepo', aprobadoEn: `${x.fecha}T18:00:00`,
    }
    hechos.push(h)
    return h
  }

  for (const [mi, mes] of meses.entries()) {
    const ultimo = mes === '2026-10' ? 26 : 30
    const bimestreIVA = ['2026-05', '2026-07', '2026-09'].includes(mes)

    // ---- Empresa A: taller y bodega
    for (let k = 0; k < 4; k++) add({ tipo: 'ingreso', fecha: dia(mes, 3 + k * 6 + Math.floor(r() * 3)), monto: entre(4_200_000, 8_600_000), descripcion: 'Venta de servicios de taller', ent: 'emp-a', categoriaId: 'cat-ventas', terceroId: k % 2 ? 'ter-clientes' : 'ter-nova', proyectoId: 'pry-taller' })
    add({ tipo: 'gasto', fecha: dia(mes, 15), monto: 4_820_000, descripcion: 'Nómina primera quincena taller', ent: 'emp-a', categoriaId: 'cat-nomina', proyectoId: 'pry-taller' })
    if (mes !== '2026-10') add({ tipo: 'gasto', fecha: dia(mes, ultimo), monto: 4_820_000, descripcion: 'Nómina segunda quincena taller', ent: 'emp-a', categoriaId: 'cat-nomina', proyectoId: 'pry-taller' })
    for (let k = 0; k < 3; k++) add({ tipo: 'costo', fecha: dia(mes, 4 + k * 8), monto: entre(900_000, 2_800_000), descripcion: 'Compra de materiales e insumos', ent: 'emp-a', categoriaId: 'cat-materiales', terceroId: 'ter-tornillo', proyectoId: 'pry-taller' })
    if (mes !== '2026-10') add({ tipo: 'gasto', fecha: dia(mes, 5), monto: 2_350_000, descripcion: 'Arriendo de la bodega', ent: 'emp-a', categoriaId: 'cat-arriendo', terceroId: 'ter-rios', proyectoId: 'pry-bodega' })
    if (mes !== '2026-06') add({ tipo: 'gasto', fecha: dia(mes, 18), monto: entre(620_000, 910_000, 1_000), descripcion: 'Servicios públicos taller', ent: 'emp-a', categoriaId: 'cat-servicios', terceroId: 'ter-epm' })
    if (bimestreIVA) add({ tipo: 'gasto', fecha: dia(mes, 12), monto: entre(2_400_000, 3_300_000, 1_000), descripcion: 'IVA bimestral', ent: 'emp-a', categoriaId: 'cat-iva', terceroId: 'ter-dian' })
    add({ tipo: 'gasto', fecha: dia(mes, 9 + Math.floor(r() * 10)), monto: entre(120_000, 480_000, 1_000), descripcion: 'Transporte y fletes', ent: 'emp-a', categoriaId: 'cat-transporte', terceroId: 'ter-rapido' })
    if (mi === 2 || mi === 4) add({ tipo: 'inversion_proyecto', fecha: dia(mes, 22), monto: entre(3_500_000, 6_000_000), descripcion: 'Adecuación de la bodega (estantería y piso)', ent: 'emp-a', categoriaId: 'cat-inversion', proyectoId: 'pry-bodega' })

    // ---- Empresa B: comercial
    for (let k = 0; k < 7; k++) add({ tipo: 'ingreso', fecha: dia(mes, 2 + k * 4), monto: entre(3_100_000, 7_800_000), descripcion: 'Venta de mercancía', ent: 'emp-b', categoriaId: 'cat-ventas', terceroId: k % 3 ? 'ter-clientes' : 'ter-andina' })
    for (let k = 0; k < 4; k++) add({ tipo: 'costo', fecha: dia(mes, 3 + k * 7), monto: entre(3_000_000, 6_200_000), descripcion: 'Compra de mercancía', ent: 'emp-b', categoriaId: 'cat-mercancia', terceroId: 'ter-andina' })
    add({ tipo: 'gasto', fecha: dia(mes, 15), monto: 6_240_000, descripcion: 'Nómina primera quincena', ent: 'emp-b', categoriaId: 'cat-nomina' })
    if (mes !== '2026-10') add({ tipo: 'gasto', fecha: dia(mes, ultimo), monto: 6_240_000, descripcion: 'Nómina segunda quincena', ent: 'emp-b', categoriaId: 'cat-nomina' })
    add({ tipo: 'gasto', fecha: dia(mes, 1), monto: 3_800_000, descripcion: 'Arriendo local comercial', ent: 'emp-b', categoriaId: 'cat-arriendo', terceroId: 'ter-inmolaureles' })
    if (mes !== '2026-10') add({ tipo: 'gasto', fecha: dia(mes, 20), monto: entre(540_000, 780_000, 1_000), descripcion: 'Servicios públicos local', ent: 'emp-b', categoriaId: 'cat-servicios', terceroId: 'ter-epm' })
    if (bimestreIVA) add({ tipo: 'gasto', fecha: dia(mes, 12), monto: entre(4_100_000, 5_200_000, 1_000), descripcion: 'IVA bimestral', ent: 'emp-b', categoriaId: 'cat-iva', terceroId: 'ter-dian' })
    add({ tipo: 'gasto', fecha: dia(mes, 11), monto: entre(250_000, 700_000, 1_000), descripcion: 'Fletes de entrega', ent: 'emp-b', categoriaId: 'cat-transporte', terceroId: 'ter-rapido' })

    // ---- Empresa C: construcción
    for (let k = 0; k < 2; k++) add({ tipo: 'ingreso', fecha: dia(mes, 6 + k * 14), monto: entre(14_000_000, 21_000_000, 100_000), descripcion: 'Acta de obra Laureles', ent: 'emp-c', categoriaId: 'cat-anticipo', terceroId: 'ter-horizonte', proyectoId: 'pry-laureles' })
    for (let k = 0; k < 4; k++) add({ tipo: 'costo', fecha: dia(mes, 3 + k * 6), monto: entre(2_200_000, 5_600_000), descripcion: k % 2 ? 'Concreto premezclado' : 'Materiales de obra', ent: 'emp-c', categoriaId: 'cat-materiales', terceroId: k % 2 ? 'ter-concretos' : 'ter-tornillo', proyectoId: 'pry-laureles' })
    add({ tipo: 'costo', fecha: dia(mes, 13), monto: entre(3_000_000, 4_500_000), descripcion: 'Pago contratista de mampostería', ent: 'emp-c', categoriaId: 'cat-contratistas', proyectoId: 'pry-laureles' })
    add({ tipo: 'gasto', fecha: dia(mes, 15), monto: 5_480_000, descripcion: 'Nómina primera quincena', ent: 'emp-c', categoriaId: 'cat-nomina' })
    if (mes !== '2026-10') add({ tipo: 'gasto', fecha: dia(mes, ultimo), monto: 5_480_000, descripcion: 'Nómina segunda quincena', ent: 'emp-c', categoriaId: 'cat-nomina' })
    if (bimestreIVA) add({ tipo: 'gasto', fecha: dia(mes, 12), monto: entre(1_600_000, 2_300_000, 1_000), descripcion: 'IVA bimestral', ent: 'emp-c', categoriaId: 'cat-iva', terceroId: 'ter-dian' })

    // ---- Empresa D: servicios
    for (let k = 0; k < 5; k++) add({ tipo: 'ingreso', fecha: dia(mes, 4 + k * 5), monto: entre(1_900_000, 4_600_000), descripcion: 'Servicios de consultoría', ent: 'emp-d', categoriaId: 'cat-servicios-prest', terceroId: 'ter-clientes' })
    add({ tipo: 'gasto', fecha: dia(mes, 15), monto: 3_150_000, descripcion: 'Nómina primera quincena', ent: 'emp-d', categoriaId: 'cat-nomina' })
    if (mes !== '2026-10') add({ tipo: 'gasto', fecha: dia(mes, ultimo), monto: 3_150_000, descripcion: 'Nómina segunda quincena', ent: 'emp-d', categoriaId: 'cat-nomina' })
    add({ tipo: 'gasto', fecha: dia(mes, 3), monto: 1_600_000, descripcion: 'Arriendo oficina', ent: 'emp-d', categoriaId: 'cat-arriendo', terceroId: 'ter-inmolaureles' })
    add({ tipo: 'gasto', fecha: dia(mes, 21), monto: entre(310_000, 460_000, 1_000), descripcion: 'Internet y energía oficina', ent: 'emp-d', categoriaId: 'cat-servicios', terceroId: 'ter-epm' })
    if (bimestreIVA) add({ tipo: 'gasto', fecha: dia(mes, 12), monto: entre(900_000, 1_400_000, 1_000), descripcion: 'IVA bimestral', ent: 'emp-d', categoriaId: 'cat-iva', terceroId: 'ter-dian' })

    // ---- Empresa E: inmobiliaria
    add({ tipo: 'ingreso', fecha: dia(mes, 5), monto: 2_800_000, descripcion: 'Canon local 101', ent: 'emp-e', categoriaId: 'cat-arriendos-rec', terceroId: 'ter-clientes' })
    add({ tipo: 'ingreso', fecha: dia(mes, 6), monto: 1_900_000, descripcion: 'Canon apartamento 302', ent: 'emp-e', categoriaId: 'cat-arriendos-rec', terceroId: 'ter-clientes' })
    add({ tipo: 'ingreso', fecha: dia(mes, 8), monto: 3_100_000, descripcion: 'Canon local 104', ent: 'emp-e', categoriaId: 'cat-arriendos-rec', terceroId: 'ter-clientes' })
    add({ tipo: 'gasto', fecha: dia(mes, 10), monto: 450_000, descripcion: 'Administración copropiedad', ent: 'emp-e', categoriaId: 'cat-administracion' })
    if (mi >= 1) add({ tipo: 'inversion_proyecto', fecha: dia(mes, 16), monto: entre(1_800_000, 4_200_000), descripcion: 'Remodelación local 104 (obra civil)', ent: 'emp-e', categoriaId: 'cat-inversion', terceroId: 'ter-arquitecta', proyectoId: 'pry-local' })
    add({ tipo: 'gasto', fecha: dia(mes, 19), monto: entre(150_000, 420_000, 1_000), descripcion: 'Mantenimiento inmuebles', ent: 'emp-e', categoriaId: 'cat-mantenimiento' })

    // ---- Asuntos personales
    add({ tipo: 'ingreso', fecha: dia(mes, 1), monto: 8_000_000, descripcion: 'Honorarios junta directiva', ent: 'personal', categoriaId: 'cat-servicios-prest' })
    add({ tipo: 'gasto', fecha: dia(mes, 5), monto: 1_250_000, descripcion: 'Medicina prepagada', ent: 'personal', categoriaId: 'cat-personales' })
    add({ tipo: 'gasto', fecha: dia(mes, 7), monto: 2_180_000, descripcion: 'Pensión colegio', ent: 'personal', categoriaId: 'cat-personales', sinSoporte: true })
    add({ tipo: 'gasto', fecha: dia(mes, 14 + Math.floor(r() * 8)), monto: entre(900_000, 2_400_000), descripcion: 'Pago tarjeta de crédito', ent: 'personal', categoriaId: 'cat-personales' })
  }

  // ---- Intercompañías y gasto repartido
  add({ tipo: 'gasto', fecha: '2026-06-18', monto: 846_000, descripcion: 'Servicios públicos taller (pagados por B)', ent: 'emp-a', pagador: 'emp-b', categoriaId: 'cat-servicios', terceroId: 'ter-epm' })
  add({ tipo: 'pago_intercompania', fecha: '2026-07-08', monto: 846_000, descripcion: 'Devolución servicios de junio a Empresa B', ent: 'emp-b', pagador: 'emp-a', cuentaOrigenId: 'cta-bancob', cuentaDestinoId: 'cta-bancolombia' })
  add({ tipo: 'gasto', fecha: '2026-08-12', monto: 1_200_000, descripcion: 'Honorarios abogado contrato arrendamiento (pagado por D)', ent: 'emp-e', pagador: 'emp-d', categoriaId: 'cat-honorarios' })
  add({ tipo: 'costo', fecha: '2026-09-09', monto: 3_400_000, descripcion: 'Hierro para Obra Laureles (pagado por B)', ent: 'emp-c', pagador: 'emp-b', categoriaId: 'cat-materiales', terceroId: 'ter-tornillo', asign: [{ entidadId: 'emp-c', proyectoId: 'pry-laureles', monto: 3_400_000 }] })
  add({ tipo: 'pago_intercompania', fecha: '2026-10-02', monto: 1_500_000, descripcion: 'Abono a Empresa B por el hierro de Laureles', ent: 'emp-b', pagador: 'emp-c', cuentaOrigenId: 'cta-davivienda', cuentaDestinoId: 'cta-bancolombia' })
  add({ tipo: 'gasto', fecha: '2026-10-14', monto: 620_000, descripcion: 'Reparación compresor del taller (pagado con plata personal)', ent: 'emp-a', pagador: 'personal', categoriaId: 'cat-mantenimiento', sinSoporte: true, asign: [{ entidadId: 'emp-a', proyectoId: 'pry-taller', monto: 620_000 }] })
  add({ tipo: 'gasto', fecha: '2026-09-25', monto: 3_600_000, descripcion: 'Honorarios contables septiembre (repartido)', ent: 'emp-a', pagador: 'emp-a', categoriaId: 'cat-honorarios', terceroId: 'ter-contador',
    asign: [{ entidadId: 'emp-a', monto: 900_000 }, { entidadId: 'emp-b', monto: 900_000 }, { entidadId: 'emp-c', monto: 900_000 }, { entidadId: 'emp-d', monto: 900_000 }] })
  add({ tipo: 'traslado', fecha: '2026-08-04', monto: 5_000_000, descripcion: 'Traslado de Bancolombia a Banco B (préstamo de B a A)', ent: 'emp-a', pagador: 'emp-b', cuentaOrigenId: 'cta-bancolombia', cuentaDestinoId: 'cta-bancob' })

  // ---- Créditos
  const creditos: Credito[] = [
    { id: 'cred-constructor', nombre: 'Crédito constructor', banco: 'Davivienda', entidadId: 'emp-c', cuentaId: 'cta-davivienda', monto: 60_000_000, tasa: { valor: 0.145, tipo: 'EA' }, numCuotas: 24, primeraFecha: '2026-09-05', cargosPorCuota: 45_000, pagos: [], saldosBanco: [], cambios: [] },
    { id: 'cred-leasing', nombre: 'Leasing camión de reparto', banco: 'Bancolombia', entidadId: 'emp-b', cuentaId: 'cta-bancolombia', monto: 85_000_000, tasa: { valor: 0.132, tipo: 'EA' }, numCuotas: 60, primeraFecha: '2025-03-15', cargosPorCuota: 120_000, pagos: [], saldosBanco: [{ fecha: '2026-09-30', saldo: 66_284_000 }], cambios: [] },
    { id: 'cred-capital-a', nombre: 'Capital de trabajo taller', banco: 'Banco B', entidadId: 'emp-a', cuentaId: 'cta-bancob', monto: 40_000_000, tasa: { valor: 0.168, tipo: 'EA' }, numCuotas: 36, primeraFecha: '2025-11-10', cargosPorCuota: 35_000, pagos: [], saldosBanco: [], cambios: [] },
    { id: 'cred-tesoreria-d', nombre: 'Crédito de tesorería', banco: 'Banco de Bogotá', entidadId: 'emp-d', cuentaId: 'cta-bogota', monto: 25_000_000, tasa: { valor: 0.0125, tipo: 'MV' }, numCuotas: 18, primeraFecha: '2026-02-25', cargosPorCuota: 20_000, pagos: [], saldosBanco: [], cambios: [] },
    { id: 'cred-vehiculo-p', nombre: 'Crédito vehículo familiar', banco: 'Bancolombia', entidadId: 'personal', cuentaId: 'cta-efectivo', monto: 30_000_000, tasa: { valor: 0.18, tipo: 'EA' }, numCuotas: 48, primeraFecha: '2024-06-01', cargosPorCuota: 0, pagos: [], saldosBanco: [], cambios: [] },
  ]

  add({ tipo: 'desembolso_credito', fecha: '2026-08-20', monto: 60_000_000, descripcion: 'Desembolso crédito constructor', ent: 'emp-c', creditoId: 'cred-constructor' })
  for (const c of creditos) {
    for (const f of tablaAmortizacion(c)) {
      if (f.fecha >= HOY_DEMO) break
      if (c.id === 'cred-constructor' && f.numero >= 2) break // cuota 2 vencida (Ejemplo 3)
      if (f.fecha < INI) { c.pagos.push({ hechoId: '', numeroCuota: f.numero, capital: f.capital, interes: f.interes, cargos: f.cargos, fecha: f.fecha }); continue }
      const h = add({ tipo: 'pago_credito', fecha: f.fecha, monto: f.total, descripcion: `Cuota ${f.numero} ${c.nombre.toLowerCase()}`, ent: c.entidadId, creditoId: c.id, numeroCuota: f.numero, categoriaId: 'cat-financiero', desglose: { capital: f.capital, interes: f.interes, cargos: f.cargos } })
      c.pagos.push({ hechoId: h.id, numeroCuota: f.numero, capital: f.capital, interes: f.interes, cargos: f.cargos, fecha: f.fecha })
    }
  }

  hechos.sort((a, b) => a.fecha.localeCompare(b.fecha))

  const obligaciones: Obligacion[] = [
    { id: 'ob-arr-bodega', nombre: 'Arriendo de la bodega', entidadId: 'emp-a', valor: 2_350_000, diaVencimiento: 5, recurrencia: 'mensual', responsableId: 'res-laura', categoriaId: 'cat-arriendo', cumplidas: [] },
    { id: 'ob-arr-local-b', nombre: 'Arriendo local comercial', entidadId: 'emp-b', valor: 3_800_000, diaVencimiento: 1, recurrencia: 'mensual', responsableId: 'res-laura', categoriaId: 'cat-arriendo', cumplidas: [] },
    { id: 'ob-arr-oficina-d', nombre: 'Arriendo oficina', entidadId: 'emp-d', valor: 1_600_000, diaVencimiento: 3, recurrencia: 'mensual', responsableId: 'res-camila', categoriaId: 'cat-arriendo', cumplidas: [] },
    { id: 'ob-nom-a', nombre: 'Nómina taller', entidadId: 'emp-a', valor: 4_820_000, recurrencia: 'quincenal', responsableId: 'res-laura', categoriaId: 'cat-nomina', cumplidas: [] },
    { id: 'ob-nom-b', nombre: 'Nómina Empresa B', entidadId: 'emp-b', valor: 6_240_000, recurrencia: 'quincenal', responsableId: 'res-laura', categoriaId: 'cat-nomina', cumplidas: [] },
    { id: 'ob-nom-c', nombre: 'Nómina Empresa C', entidadId: 'emp-c', valor: 5_480_000, recurrencia: 'quincenal', responsableId: 'res-andres', categoriaId: 'cat-nomina', cumplidas: [] },
    { id: 'ob-nom-d', nombre: 'Nómina Empresa D', entidadId: 'emp-d', valor: 3_150_000, recurrencia: 'quincenal', responsableId: 'res-camila', categoriaId: 'cat-nomina', cumplidas: [] },
    { id: 'ob-iva-a', nombre: 'IVA bimestral', entidadId: 'emp-a', valor: 2_900_000, diaVencimiento: 12, recurrencia: 'bimestral', responsableId: 'res-carlos', categoriaId: 'cat-iva', cumplidas: [] },
    { id: 'ob-iva-b', nombre: 'IVA bimestral', entidadId: 'emp-b', valor: 4_700_000, diaVencimiento: 12, recurrencia: 'bimestral', responsableId: 'res-carlos', categoriaId: 'cat-iva', cumplidas: [] },
    { id: 'ob-serv-a', nombre: 'Servicios públicos taller', entidadId: 'emp-a', valor: 780_000, diaVencimiento: 18, recurrencia: 'mensual', responsableId: 'res-camila', categoriaId: 'cat-servicios', cumplidas: [] },
    { id: 'ob-serv-b', nombre: 'Servicios públicos local', entidadId: 'emp-b', valor: 690_000, diaVencimiento: 20, recurrencia: 'mensual', responsableId: 'res-camila', categoriaId: 'cat-servicios', cumplidas: [] },
    { id: 'ob-admin-e', nombre: 'Administración copropiedad', entidadId: 'emp-e', valor: 450_000, diaVencimiento: 10, recurrencia: 'mensual', responsableId: 'res-andres', categoriaId: 'cat-administracion', cumplidas: [] },
    { id: 'ob-prepagada', nombre: 'Medicina prepagada', entidadId: 'personal', valor: 1_250_000, diaVencimiento: 5, recurrencia: 'mensual', responsableId: 'res-andres', categoriaId: 'cat-personales', cumplidas: [] },
    { id: 'ob-poliza', nombre: 'Renovación póliza todo riesgo bodega', entidadId: 'emp-a', valor: 3_480_000, fecha: '2026-11-20', recurrencia: 'unica', responsableId: 'res-laura', cumplidas: [] },
    { id: 'ob-predial', nombre: 'Impuesto predial (2.º semestre)', entidadId: 'emp-e', valor: 2_640_000, fecha: '2026-11-14', recurrencia: 'unica', responsableId: 'res-andres', cumplidas: [] },
  ]
  // Marca como cumplidas las ocurrencias que tienen un hecho semilla (misma entidad y categoría, ±4 días).
  for (const o of obligaciones) {
    for (const h of hechos) {
      if (h.asignaciones[0]?.entidadId !== o.entidadId || h.categoriaId !== o.categoriaId || h.tipo === 'pago_credito') continue
      o.cumplidas.push({ periodo: h.fecha, hechoId: h.id, fecha: h.fecha })
    }
  }

  const tareas: Tarea[] = [
    { id: 't-1', titulo: 'Enviar extractos de octubre al contador', vence: '2026-11-04', hecha: false, entidadId: 'emp-a' },
    { id: 't-2', titulo: 'Renovar SOAT del camión de reparto', vence: '2026-10-26', hecha: false, entidadId: 'emp-b' },
    { id: 't-3', titulo: 'Firmar otrosí del contrato de la bodega', vence: '2026-11-08', hecha: false, entidadId: 'emp-a' },
  ]

  const historial: EventoHistorial[] = [
    { fecha: '2026-05-01T09:00:00', usuario: 'Laura Restrepo', accion: 'Carga inicial', objeto: 'Saldos iniciales', detalle: 'Saldos iniciales de 6 cuentas al 01/05/2026' },
    { fecha: '2026-05-02T10:15:00', usuario: 'Laura Restrepo', accion: 'Carga inicial', objeto: 'Google Drive', detalle: '412 archivos encontrados, 398 cargados, 11 omitidos (duplicados), 3 fallidos' },
    { fecha: '2026-10-06T17:40:00', usuario: 'Carlos Mejía', accion: 'Publicó cierre', objeto: 'Cierre septiembre 2026', detalle: '6 cuentas conciliadas' },
  ]

  return { hechos, soportes, creditos, obligaciones, tareas, historial }
}

/** Cierres de septiembre ya publicados (saldoSistema se calcula al crear el estado inicial). */
export function cierresSeptiembre(saldo: (cuentaId: string) => number): Cierre[] {
  return cuentas.map((c) => {
    const s = saldo(c.id)
    const gmf = c.banco === 'Bancolombia' ? -38_400 : 0
    return {
      id: `cierre-2026-09-${c.id}`, entidadId: c.entidadId, cuentaId: c.id, mes: '2026-09',
      saldoSistema: s, saldoExtracto: s + gmf,
      diferencias: gmf ? [{ monto: gmf, explicacion: 'GMF (4 x 1.000) de septiembre, se registra en octubre' }] : [],
      estado: 'publicado', reaperturas: [], publicadoEn: '2026-10-06T17:40:00',
    }
  })
}

/** Mensajes que ya están en la bandeja al iniciar la demo (la IA simulada los procesa al cargar). */
export const bandejaInicial = [
  { canal: 'whatsapp' as const, recibidoEn: '2026-10-27T16:42:00', nombre: 'WhatsApp · Camila Ortiz', texto: 'Le transferí 1.450.000 a la ferretería El Tornillo por materiales del taller desde el Banco B de la Empresa A' },
  { canal: 'whatsapp' as const, recibidoEn: '2026-10-28T08:05:00', nombre: 'WhatsApp · Andrés Gómez', texto: 'Nos consignaron 18,5 millones de Constructora Horizonte en Davivienda de la Empresa C por el acta de obra de Laureles' },
  { canal: 'correo' as const, recibidoEn: '2026-10-28T07:30:00', nombre: 'correo-proveedor.eml', archivo: 'correo-proveedor.eml' },
  { canal: 'whatsapp' as const, recibidoEn: '2026-10-26T19:10:00', nombre: 'WhatsApp · Andrés Gómez', texto: 'Ya le pagué lo del contador' },
]
