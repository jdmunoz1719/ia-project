// Datos semilla: mayo a octubre de 2026. Generación determinística (misma semilla = mismos datos).
import { amortizationSchedule } from '@/domain/amortization'
import type {
  Category, MonthClose, Loan, Account, Entity, AuditEvent, Transaction, Obligation, Project,
  Assignee, Attachment, Task, Counterparty, TransactionType,
} from '@/domain/types'

export const DEMO_TODAY = '2026-10-28'

export const entities: Entity[] = [
  { id: 'emp-a', name: 'Empresa A', alias: ['empresa a'], isPersonal: false, description: 'Taller y bodega' },
  { id: 'emp-b', name: 'Empresa B', alias: ['empresa b'], isPersonal: false, description: 'Comercial' },
  { id: 'emp-c', name: 'Empresa C', alias: ['empresa c', 'la constructora'], isPersonal: false, description: 'Construcción' },
  { id: 'emp-d', name: 'Empresa D', alias: ['empresa d'], isPersonal: false, description: 'Servicios' },
  { id: 'emp-e', name: 'Empresa E', alias: ['empresa e', 'la inmobiliaria'], isPersonal: false, description: 'Inmobiliaria' },
  { id: 'personal', name: 'Asuntos personales', alias: ['personal', 'asuntos personales', 'lo personal', 'socios'], isPersonal: true, description: 'Gastos de los socios' },
]

const SEED_START = '2026-05-01'
export const accounts: Account[] = [
  { id: 'cta-bancob', entityId: 'emp-a', bank: 'Banco B', name: 'Banco B · Corriente 4471', alias: ['banco b'], openingBalance: 38_400_000, openingBalanceDate: SEED_START },
  { id: 'cta-bancolombia', entityId: 'emp-b', bank: 'Bancolombia', name: 'Bancolombia · Ahorros 2093', alias: ['bancolombia'], openingBalance: 52_750_000, openingBalanceDate: SEED_START },
  { id: 'cta-davivienda', entityId: 'emp-c', bank: 'Davivienda', name: 'Davivienda · Corriente 8810', alias: ['davivienda'], openingBalance: 26_300_000, openingBalanceDate: SEED_START },
  { id: 'cta-bogota', entityId: 'emp-d', bank: 'Banco de Bogotá', name: 'Banco de Bogotá · Ahorros 1156', alias: ['banco de bogotá', 'banco de bogota', 'bogotá'], openingBalance: 19_200_000, openingBalanceDate: SEED_START },
  { id: 'cta-caja-e', entityId: 'emp-e', bank: 'Caja', name: 'Caja general E', alias: ['caja de la e', 'caja e'], openingBalance: 14_500_000, openingBalanceDate: SEED_START },
  { id: 'cta-efectivo', entityId: 'personal', bank: 'Efectivo', name: 'Efectivo socios', alias: ['efectivo', 'plata personal'], openingBalance: 9_800_000, openingBalanceDate: SEED_START },
]

export const projects: Project[] = [
  { id: 'pry-taller', entityId: 'emp-a', name: 'Taller', alias: ['taller', 'el taller'] },
  { id: 'pry-bodega', entityId: 'emp-a', name: 'Bodega', alias: ['bodega', 'la bodega'] },
  { id: 'pry-laureles', entityId: 'emp-c', name: 'Obra Laureles', alias: ['laureles', 'obra laureles', 'la obra'] },
  { id: 'pry-local', entityId: 'emp-e', name: 'Remodelación local', alias: ['remodelación', 'remodelacion', 'el local'] },
]

export const categories: Category[] = [
  { id: 'cat-ventas', name: 'Ventas', kind: 'income', alias: ['venta', 'ventas', 'factura'] },
  { id: 'cat-servicios-prest', name: 'Servicios prestados', kind: 'income', alias: ['servicio prestado', 'honorarios recibidos'] },
  { id: 'cat-arriendos-rec', name: 'Arriendos recibidos', kind: 'income', alias: ['canon', 'arriendo recibido'] },
  { id: 'cat-anticipo', name: 'Anticipos de obra', kind: 'income', alias: ['anticipo', 'acta de obra'] },
  { id: 'cat-materiales', name: 'Materiales', kind: 'cost_of_sales', alias: ['materiales', 'material', 'insumos'] },
  { id: 'cat-mercancia', name: 'Mercancía', kind: 'cost_of_sales', alias: ['mercancía', 'mercancia', 'inventario'] },
  { id: 'cat-contratistas', name: 'Mano de obra contratada', kind: 'cost_of_sales', alias: ['contratista', 'mano de obra'] },
  { id: 'cat-nomina', name: 'Nómina', kind: 'operating_expense', alias: ['nómina', 'nomina', 'sueldos', 'quincena'] },
  { id: 'cat-arriendo', name: 'Arriendo', kind: 'operating_expense', alias: ['arriendo', 'arrendamiento', 'canon de arriendo'] },
  { id: 'cat-servicios', name: 'Servicios públicos', kind: 'operating_expense', alias: ['servicios', 'luz', 'agua', 'energía', 'epm', 'internet'] },
  { id: 'cat-iva', name: 'IVA', kind: 'operating_expense', alias: ['iva'] },
  { id: 'cat-honorarios', name: 'Honorarios', kind: 'operating_expense', alias: ['contador', 'honorarios', 'revisoría', 'abogado'] },
  { id: 'cat-transporte', name: 'Transporte', kind: 'operating_expense', alias: ['transporte', 'flete', 'gasolina', 'peajes'] },
  { id: 'cat-mantenimiento', name: 'Mantenimiento', kind: 'operating_expense', alias: ['mantenimiento', 'reparación', 'arreglo'] },
  { id: 'cat-administracion', name: 'Administración copropiedad', kind: 'operating_expense', alias: ['administración', 'administracion'] },
  { id: 'cat-personales', name: 'Gastos personales', kind: 'operating_expense', alias: ['colegio', 'mercado', 'medicina prepagada', 'tarjeta'] },
  { id: 'cat-financiero', name: 'Intereses y cargos', kind: 'financial', alias: ['intereses', 'cuota', 'seguro del crédito'] },
  { id: 'cat-inversion', name: 'Inversión en proyecto', kind: 'investment', alias: ['adecuación', 'obra', 'remodelación'] },
]

export const counterparties: Counterparty[] = [
  { id: 'ter-rios', name: 'Inversiones Ríos S.A.S.', alias: ['inversiones ríos', 'don jaime', 'arrendador de la bodega'] },
  { id: 'ter-inmolaureles', name: 'Inmobiliaria Laureles', alias: ['inmobiliaria laureles'] },
  { id: 'ter-epm', name: 'EPM', alias: ['epm', 'empresas públicas'] },
  { id: 'ter-dian', name: 'DIAN', alias: ['dian'] },
  { id: 'ter-tornillo', name: 'Ferretería El Tornillo', alias: ['ferretería el tornillo', 'el tornillo', 'la ferretería'] },
  { id: 'ter-concretos', name: 'Concretos del Valle S.A.', alias: ['concretos del valle', 'concretos'] },
  { id: 'ter-horizonte', name: 'Constructora Horizonte S.A.S.', alias: ['constructora horizonte', 'horizonte'] },
  { id: 'ter-nova', name: 'Comercializadora Nova', alias: ['comercializadora nova', 'nova'] },
  { id: 'ter-rapido', name: 'Transportes Rápido Sur', alias: ['rápido sur', 'rapido sur'] },
  { id: 'ter-andina', name: 'Distribuidora Andina', alias: ['distribuidora andina', 'andina'] },
  { id: 'ter-contador', name: 'Carlos Mejía Contador', alias: ['carlos', 'el contador'] },
  { id: 'ter-arquitecta', name: 'Arq. Paula Henao', alias: ['paula', 'la arquitecta'] },
  { id: 'ter-clientes', name: 'Clientes varios', alias: ['cliente', 'clientes'] },
]

export const assignees: Assignee[] = [
  { id: 'res-laura', name: 'Laura Restrepo', position: 'Administradora' },
  { id: 'res-andres', name: 'Andrés Gómez', position: 'Socio' },
  { id: 'res-camila', name: 'Camila Ortiz', position: 'Asistente administrativa' },
  { id: 'res-carlos', name: 'Carlos Mejía', position: 'Contador' },
]

// ---------------- Generación de movimientos ----------------
function prng(seedValue: number) {
  let a = seedValue
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function generateSeed() {
  const r = prng(20261028)
  const between = (min: number, max: number, step = 10_000) => Math.round((min + r() * (max - min)) / step) * step
  const months = ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']
  const transactions: Transaction[] = []
  const attachments: Attachment[] = []
  let n = 0

  const accountOf = (ent: string) => accounts.find((c) => c.entityId === ent)!.id
  const day = (month: string, d: number) => `${month}-${String(Math.min(d, month === '2026-10' ? 26 : 30)).padStart(2, '0')}`

  type NewTx = {
    type: TransactionType; date: string; amount: number; description: string; ent: string
    payer?: string; allocs?: { entityId: string; projectId?: string; amount: number }[]
    categoryId?: string; counterpartyId?: string; projectId?: string; destinationAccountId?: string; sourceAccountId?: string
    loanId?: string; installmentNumber?: number; breakdown?: Transaction['loanPaymentBreakdown']; withoutAttachment?: boolean
  }
  const add = (x: NewTx) => {
    const id = `h-${String(++n).padStart(4, '0')}`
    const payer = x.payer ?? x.ent
    const inflow = x.type === 'income' || x.type === 'loan_disbursement'
    const attachmentIds: string[] = []
    // ~12 % sin soporte
    if (!x.withoutAttachment && r() > 0.12) {
      const isPhoto = r() > 0.55
      const s: Attachment = {
        id: `s-${id}`, name: `${isPhoto ? 'foto' : 'comprobante'}-${x.date.replaceAll('-', '')}-${n}.${isPhoto ? 'jpg' : 'pdf'}`,
        mimeType: isPhoto ? 'image/jpeg' : 'application/pdf', size: Math.round(80_000 + r() * 900_000),
        mockUrl: isPhoto ? '/demo/recibo-arriendo-bodega.jpg' : '/demo/factura-servicios.pdf',
        receivedAt: `${x.date}T${String(8 + Math.floor(r() * 10)).padStart(2, '0')}:${String(Math.floor(r() * 60)).padStart(2, '0')}:00`,
        channel: (['whatsapp', 'manual', 'email', 'drive'] as const)[Math.floor(r() * 4)], hash: `seed-${n}`,
        bodyText: `${x.description} — ${x.amount.toLocaleString('es-CO')}`,
      }
      attachments.push(s); attachmentIds.push(s.id)
    }
    const h: Transaction = {
      id, type: x.type, date: x.date, amount: x.amount, description: x.description,
      payerEntityId: payer,
      sourceAccountId: x.sourceAccountId ?? (inflow ? undefined : accountOf(payer)),
      destinationAccountId: x.destinationAccountId ?? (inflow ? accountOf(payer) : undefined),
      allocations: x.allocs ?? [{ entityId: x.ent, projectId: x.projectId, amount: x.amount }],
      categoryId: x.categoryId, counterpartyId: x.counterpartyId, loanId: x.loanId, installmentNumber: x.installmentNumber,
      loanPaymentBreakdown: x.breakdown, attachmentIds, approvedBy: 'Laura Restrepo', approvedAt: `${x.date}T18:00:00`,
    }
    transactions.push(h)
    return h
  }

  for (const [mi, month] of months.entries()) {
    const lastDay = month === '2026-10' ? 26 : 30
    const vatBimester = ['2026-05', '2026-07', '2026-09'].includes(month)

    // ---- Empresa A: taller y bodega
    for (let k = 0; k < 4; k++) add({ type: 'income', date: day(month, 3 + k * 6 + Math.floor(r() * 3)), amount: between(4_200_000, 8_600_000), description: 'Venta de servicios de taller', ent: 'emp-a', categoryId: 'cat-ventas', counterpartyId: k % 2 ? 'ter-clientes' : 'ter-nova', projectId: 'pry-taller' })
    add({ type: 'expense', date: day(month, 15), amount: 4_820_000, description: 'Nómina primera quincena taller', ent: 'emp-a', categoryId: 'cat-nomina', projectId: 'pry-taller' })
    if (month !== '2026-10') add({ type: 'expense', date: day(month, lastDay), amount: 4_820_000, description: 'Nómina segunda quincena taller', ent: 'emp-a', categoryId: 'cat-nomina', projectId: 'pry-taller' })
    for (let k = 0; k < 3; k++) add({ type: 'cost', date: day(month, 4 + k * 8), amount: between(900_000, 2_800_000), description: 'Compra de materiales e insumos', ent: 'emp-a', categoryId: 'cat-materiales', counterpartyId: 'ter-tornillo', projectId: 'pry-taller' })
    if (month !== '2026-10') add({ type: 'expense', date: day(month, 5), amount: 2_350_000, description: 'Arriendo de la bodega', ent: 'emp-a', categoryId: 'cat-arriendo', counterpartyId: 'ter-rios', projectId: 'pry-bodega' })
    if (month !== '2026-06') add({ type: 'expense', date: day(month, 18), amount: between(620_000, 910_000, 1_000), description: 'Servicios públicos taller', ent: 'emp-a', categoryId: 'cat-servicios', counterpartyId: 'ter-epm' })
    if (vatBimester) add({ type: 'expense', date: day(month, 12), amount: between(2_400_000, 3_300_000, 1_000), description: 'IVA bimestral', ent: 'emp-a', categoryId: 'cat-iva', counterpartyId: 'ter-dian' })
    add({ type: 'expense', date: day(month, 9 + Math.floor(r() * 10)), amount: between(120_000, 480_000, 1_000), description: 'Transporte y fletes', ent: 'emp-a', categoryId: 'cat-transporte', counterpartyId: 'ter-rapido' })
    if (mi === 2 || mi === 4) add({ type: 'project_investment', date: day(month, 22), amount: between(3_500_000, 6_000_000), description: 'Adecuación de la bodega (estantería y piso)', ent: 'emp-a', categoryId: 'cat-inversion', projectId: 'pry-bodega' })

    // ---- Empresa B: comercial
    for (let k = 0; k < 7; k++) add({ type: 'income', date: day(month, 2 + k * 4), amount: between(3_100_000, 7_800_000), description: 'Venta de mercancía', ent: 'emp-b', categoryId: 'cat-ventas', counterpartyId: k % 3 ? 'ter-clientes' : 'ter-andina' })
    for (let k = 0; k < 4; k++) add({ type: 'cost', date: day(month, 3 + k * 7), amount: between(3_000_000, 6_200_000), description: 'Compra de mercancía', ent: 'emp-b', categoryId: 'cat-mercancia', counterpartyId: 'ter-andina' })
    add({ type: 'expense', date: day(month, 15), amount: 6_240_000, description: 'Nómina primera quincena', ent: 'emp-b', categoryId: 'cat-nomina' })
    if (month !== '2026-10') add({ type: 'expense', date: day(month, lastDay), amount: 6_240_000, description: 'Nómina segunda quincena', ent: 'emp-b', categoryId: 'cat-nomina' })
    add({ type: 'expense', date: day(month, 1), amount: 3_800_000, description: 'Arriendo local comercial', ent: 'emp-b', categoryId: 'cat-arriendo', counterpartyId: 'ter-inmolaureles' })
    if (month !== '2026-10') add({ type: 'expense', date: day(month, 20), amount: between(540_000, 780_000, 1_000), description: 'Servicios públicos local', ent: 'emp-b', categoryId: 'cat-servicios', counterpartyId: 'ter-epm' })
    if (vatBimester) add({ type: 'expense', date: day(month, 12), amount: between(4_100_000, 5_200_000, 1_000), description: 'IVA bimestral', ent: 'emp-b', categoryId: 'cat-iva', counterpartyId: 'ter-dian' })
    add({ type: 'expense', date: day(month, 11), amount: between(250_000, 700_000, 1_000), description: 'Fletes de entrega', ent: 'emp-b', categoryId: 'cat-transporte', counterpartyId: 'ter-rapido' })

    // ---- Empresa C: construcción
    for (let k = 0; k < 2; k++) add({ type: 'income', date: day(month, 6 + k * 14), amount: between(14_000_000, 21_000_000, 100_000), description: 'Acta de obra Laureles', ent: 'emp-c', categoryId: 'cat-anticipo', counterpartyId: 'ter-horizonte', projectId: 'pry-laureles' })
    for (let k = 0; k < 4; k++) add({ type: 'cost', date: day(month, 3 + k * 6), amount: between(2_200_000, 5_600_000), description: k % 2 ? 'Concreto premezclado' : 'Materiales de obra', ent: 'emp-c', categoryId: 'cat-materiales', counterpartyId: k % 2 ? 'ter-concretos' : 'ter-tornillo', projectId: 'pry-laureles' })
    add({ type: 'cost', date: day(month, 13), amount: between(3_000_000, 4_500_000), description: 'Pago contratista de mampostería', ent: 'emp-c', categoryId: 'cat-contratistas', projectId: 'pry-laureles' })
    add({ type: 'expense', date: day(month, 15), amount: 5_480_000, description: 'Nómina primera quincena', ent: 'emp-c', categoryId: 'cat-nomina' })
    if (month !== '2026-10') add({ type: 'expense', date: day(month, lastDay), amount: 5_480_000, description: 'Nómina segunda quincena', ent: 'emp-c', categoryId: 'cat-nomina' })
    if (vatBimester) add({ type: 'expense', date: day(month, 12), amount: between(1_600_000, 2_300_000, 1_000), description: 'IVA bimestral', ent: 'emp-c', categoryId: 'cat-iva', counterpartyId: 'ter-dian' })

    // ---- Empresa D: servicios
    for (let k = 0; k < 5; k++) add({ type: 'income', date: day(month, 4 + k * 5), amount: between(1_900_000, 4_600_000), description: 'Servicios de consultoría', ent: 'emp-d', categoryId: 'cat-servicios-prest', counterpartyId: 'ter-clientes' })
    add({ type: 'expense', date: day(month, 15), amount: 3_150_000, description: 'Nómina primera quincena', ent: 'emp-d', categoryId: 'cat-nomina' })
    if (month !== '2026-10') add({ type: 'expense', date: day(month, lastDay), amount: 3_150_000, description: 'Nómina segunda quincena', ent: 'emp-d', categoryId: 'cat-nomina' })
    add({ type: 'expense', date: day(month, 3), amount: 1_600_000, description: 'Arriendo oficina', ent: 'emp-d', categoryId: 'cat-arriendo', counterpartyId: 'ter-inmolaureles' })
    add({ type: 'expense', date: day(month, 21), amount: between(310_000, 460_000, 1_000), description: 'Internet y energía oficina', ent: 'emp-d', categoryId: 'cat-servicios', counterpartyId: 'ter-epm' })
    if (vatBimester) add({ type: 'expense', date: day(month, 12), amount: between(900_000, 1_400_000, 1_000), description: 'IVA bimestral', ent: 'emp-d', categoryId: 'cat-iva', counterpartyId: 'ter-dian' })

    // ---- Empresa E: inmobiliaria
    add({ type: 'income', date: day(month, 5), amount: 2_800_000, description: 'Canon local 101', ent: 'emp-e', categoryId: 'cat-arriendos-rec', counterpartyId: 'ter-clientes' })
    add({ type: 'income', date: day(month, 6), amount: 1_900_000, description: 'Canon apartamento 302', ent: 'emp-e', categoryId: 'cat-arriendos-rec', counterpartyId: 'ter-clientes' })
    add({ type: 'income', date: day(month, 8), amount: 3_100_000, description: 'Canon local 104', ent: 'emp-e', categoryId: 'cat-arriendos-rec', counterpartyId: 'ter-clientes' })
    add({ type: 'expense', date: day(month, 10), amount: 450_000, description: 'Administración copropiedad', ent: 'emp-e', categoryId: 'cat-administracion' })
    if (mi >= 1) add({ type: 'project_investment', date: day(month, 16), amount: between(1_800_000, 4_200_000), description: 'Remodelación local 104 (obra civil)', ent: 'emp-e', categoryId: 'cat-inversion', counterpartyId: 'ter-arquitecta', projectId: 'pry-local' })
    add({ type: 'expense', date: day(month, 19), amount: between(150_000, 420_000, 1_000), description: 'Mantenimiento inmuebles', ent: 'emp-e', categoryId: 'cat-mantenimiento' })

    // ---- Asuntos personales
    add({ type: 'income', date: day(month, 1), amount: 8_000_000, description: 'Honorarios junta directiva', ent: 'personal', categoryId: 'cat-servicios-prest' })
    add({ type: 'expense', date: day(month, 5), amount: 1_250_000, description: 'Medicina prepagada', ent: 'personal', categoryId: 'cat-personales' })
    add({ type: 'expense', date: day(month, 7), amount: 2_180_000, description: 'Pensión colegio', ent: 'personal', categoryId: 'cat-personales', withoutAttachment: true })
    add({ type: 'expense', date: day(month, 14 + Math.floor(r() * 8)), amount: between(900_000, 2_400_000), description: 'Pago tarjeta de crédito', ent: 'personal', categoryId: 'cat-personales' })
  }

  // ---- Intercompañías y gasto repartido
  add({ type: 'expense', date: '2026-06-18', amount: 846_000, description: 'Servicios públicos taller (pagados por B)', ent: 'emp-a', payer: 'emp-b', categoryId: 'cat-servicios', counterpartyId: 'ter-epm' })
  add({ type: 'intercompany_payment', date: '2026-07-08', amount: 846_000, description: 'Devolución servicios de junio a Empresa B', ent: 'emp-b', payer: 'emp-a', sourceAccountId: 'cta-bancob', destinationAccountId: 'cta-bancolombia' })
  add({ type: 'expense', date: '2026-08-12', amount: 1_200_000, description: 'Honorarios abogado contrato arrendamiento (pagado por D)', ent: 'emp-e', payer: 'emp-d', categoryId: 'cat-honorarios' })
  add({ type: 'cost', date: '2026-09-09', amount: 3_400_000, description: 'Hierro para Obra Laureles (pagado por B)', ent: 'emp-c', payer: 'emp-b', categoryId: 'cat-materiales', counterpartyId: 'ter-tornillo', allocs: [{ entityId: 'emp-c', projectId: 'pry-laureles', amount: 3_400_000 }] })
  add({ type: 'intercompany_payment', date: '2026-10-02', amount: 1_500_000, description: 'Abono a Empresa B por el hierro de Laureles', ent: 'emp-b', payer: 'emp-c', sourceAccountId: 'cta-davivienda', destinationAccountId: 'cta-bancolombia' })
  add({ type: 'expense', date: '2026-10-14', amount: 620_000, description: 'Reparación compresor del taller (pagado con plata personal)', ent: 'emp-a', payer: 'personal', categoryId: 'cat-mantenimiento', withoutAttachment: true, allocs: [{ entityId: 'emp-a', projectId: 'pry-taller', amount: 620_000 }] })
  add({ type: 'expense', date: '2026-09-25', amount: 3_600_000, description: 'Honorarios contables septiembre (repartido)', ent: 'emp-a', payer: 'emp-a', categoryId: 'cat-honorarios', counterpartyId: 'ter-contador',
    allocs: [{ entityId: 'emp-a', amount: 900_000 }, { entityId: 'emp-b', amount: 900_000 }, { entityId: 'emp-c', amount: 900_000 }, { entityId: 'emp-d', amount: 900_000 }] })
  add({ type: 'transfer', date: '2026-08-04', amount: 5_000_000, description: 'Traslado de Bancolombia a Banco B (préstamo de B a A)', ent: 'emp-a', payer: 'emp-b', sourceAccountId: 'cta-bancolombia', destinationAccountId: 'cta-bancob' })

  // ---- Créditos
  const loans: Loan[] = [
    { id: 'cred-constructor', name: 'Crédito constructor', bank: 'Davivienda', entityId: 'emp-c', accountId: 'cta-davivienda', amount: 60_000_000, rate: { value: 0.145, type: 'EA' }, installmentCount: 24, firstDueDate: '2026-09-05', feesPerInstallment: 45_000, payments: [], bankBalances: [], changes: [] },
    { id: 'cred-leasing', name: 'Leasing camión de reparto', bank: 'Bancolombia', entityId: 'emp-b', accountId: 'cta-bancolombia', amount: 85_000_000, rate: { value: 0.132, type: 'EA' }, installmentCount: 60, firstDueDate: '2025-03-15', feesPerInstallment: 120_000, payments: [], bankBalances: [{ date: '2026-09-30', balance: 66_284_000 }], changes: [] },
    { id: 'cred-capital-a', name: 'Capital de trabajo taller', bank: 'Banco B', entityId: 'emp-a', accountId: 'cta-bancob', amount: 40_000_000, rate: { value: 0.168, type: 'EA' }, installmentCount: 36, firstDueDate: '2025-11-10', feesPerInstallment: 35_000, payments: [], bankBalances: [], changes: [] },
    { id: 'cred-tesoreria-d', name: 'Crédito de tesorería', bank: 'Banco de Bogotá', entityId: 'emp-d', accountId: 'cta-bogota', amount: 25_000_000, rate: { value: 0.0125, type: 'MV' }, installmentCount: 18, firstDueDate: '2026-02-25', feesPerInstallment: 20_000, payments: [], bankBalances: [], changes: [] },
    { id: 'cred-vehiculo-p', name: 'Crédito vehículo familiar', bank: 'Bancolombia', entityId: 'personal', accountId: 'cta-efectivo', amount: 30_000_000, rate: { value: 0.18, type: 'EA' }, installmentCount: 48, firstDueDate: '2024-06-01', feesPerInstallment: 0, payments: [], bankBalances: [], changes: [] },
  ]

  add({ type: 'loan_disbursement', date: '2026-08-20', amount: 60_000_000, description: 'Desembolso crédito constructor', ent: 'emp-c', loanId: 'cred-constructor' })
  for (const c of loans) {
    for (const f of amortizationSchedule(c)) {
      if (f.date >= DEMO_TODAY) break
      if (c.id === 'cred-constructor' && f.number >= 2) break // cuota 2 vencida (Ejemplo 3)
      if (f.date < SEED_START) { c.payments.push({ transactionId: '', installmentNumber: f.number, capital: f.capital, interest: f.interest, fees: f.fees, date: f.date }); continue }
      const h = add({ type: 'loan_payment', date: f.date, amount: f.total, description: `Cuota ${f.number} ${c.name.toLowerCase()}`, ent: c.entityId, loanId: c.id, installmentNumber: f.number, categoryId: 'cat-financiero', breakdown: { capital: f.capital, interest: f.interest, fees: f.fees } })
      c.payments.push({ transactionId: h.id, installmentNumber: f.number, capital: f.capital, interest: f.interest, fees: f.fees, date: f.date })
    }
  }

  transactions.sort((a, b) => a.date.localeCompare(b.date))

  const obligations: Obligation[] = [
    { id: 'ob-arr-bodega', name: 'Arriendo de la bodega', entityId: 'emp-a', value: 2_350_000, dueDay: 5, recurrence: 'monthly', assigneeId: 'res-laura', categoryId: 'cat-arriendo', fulfilled: [] },
    { id: 'ob-arr-local-b', name: 'Arriendo local comercial', entityId: 'emp-b', value: 3_800_000, dueDay: 1, recurrence: 'monthly', assigneeId: 'res-laura', categoryId: 'cat-arriendo', fulfilled: [] },
    { id: 'ob-arr-oficina-d', name: 'Arriendo oficina', entityId: 'emp-d', value: 1_600_000, dueDay: 3, recurrence: 'monthly', assigneeId: 'res-camila', categoryId: 'cat-arriendo', fulfilled: [] },
    { id: 'ob-nom-a', name: 'Nómina taller', entityId: 'emp-a', value: 4_820_000, recurrence: 'biweekly', assigneeId: 'res-laura', categoryId: 'cat-nomina', fulfilled: [] },
    { id: 'ob-nom-b', name: 'Nómina Empresa B', entityId: 'emp-b', value: 6_240_000, recurrence: 'biweekly', assigneeId: 'res-laura', categoryId: 'cat-nomina', fulfilled: [] },
    { id: 'ob-nom-c', name: 'Nómina Empresa C', entityId: 'emp-c', value: 5_480_000, recurrence: 'biweekly', assigneeId: 'res-andres', categoryId: 'cat-nomina', fulfilled: [] },
    { id: 'ob-nom-d', name: 'Nómina Empresa D', entityId: 'emp-d', value: 3_150_000, recurrence: 'biweekly', assigneeId: 'res-camila', categoryId: 'cat-nomina', fulfilled: [] },
    { id: 'ob-iva-a', name: 'IVA bimestral', entityId: 'emp-a', value: 2_900_000, dueDay: 12, recurrence: 'bimonthly', assigneeId: 'res-carlos', categoryId: 'cat-iva', fulfilled: [] },
    { id: 'ob-iva-b', name: 'IVA bimestral', entityId: 'emp-b', value: 4_700_000, dueDay: 12, recurrence: 'bimonthly', assigneeId: 'res-carlos', categoryId: 'cat-iva', fulfilled: [] },
    { id: 'ob-serv-a', name: 'Servicios públicos taller', entityId: 'emp-a', value: 780_000, dueDay: 18, recurrence: 'monthly', assigneeId: 'res-camila', categoryId: 'cat-servicios', fulfilled: [] },
    { id: 'ob-serv-b', name: 'Servicios públicos local', entityId: 'emp-b', value: 690_000, dueDay: 20, recurrence: 'monthly', assigneeId: 'res-camila', categoryId: 'cat-servicios', fulfilled: [] },
    { id: 'ob-admin-e', name: 'Administración copropiedad', entityId: 'emp-e', value: 450_000, dueDay: 10, recurrence: 'monthly', assigneeId: 'res-andres', categoryId: 'cat-administracion', fulfilled: [] },
    { id: 'ob-prepagada', name: 'Medicina prepagada', entityId: 'personal', value: 1_250_000, dueDay: 5, recurrence: 'monthly', assigneeId: 'res-andres', categoryId: 'cat-personales', fulfilled: [] },
    { id: 'ob-poliza', name: 'Renovación póliza todo riesgo bodega', entityId: 'emp-a', value: 3_480_000, date: '2026-11-20', recurrence: 'once', assigneeId: 'res-laura', fulfilled: [] },
    { id: 'ob-predial', name: 'Impuesto predial (2.º semestre)', entityId: 'emp-e', value: 2_640_000, date: '2026-11-14', recurrence: 'once', assigneeId: 'res-andres', fulfilled: [] },
  ]
  // Marca como cumplidas las ocurrencias que tienen un hecho semilla (misma entidad y categoría, ±4 días).
  for (const o of obligations) {
    for (const h of transactions) {
      if (h.allocations[0]?.entityId !== o.entityId || h.categoryId !== o.categoryId || h.type === 'loan_payment') continue
      o.fulfilled.push({ period: h.date, transactionId: h.id, date: h.date })
    }
  }

  const tasks: Task[] = [
    { id: 't-1', title: 'Enviar extractos de octubre al contador', due: '2026-11-04', done: false, entityId: 'emp-a' },
    { id: 't-2', title: 'Renovar SOAT del camión de reparto', due: '2026-10-26', done: false, entityId: 'emp-b' },
    { id: 't-3', title: 'Firmar otrosí del contrato de la bodega', due: '2026-11-08', done: false, entityId: 'emp-a' },
  ]

  const history: AuditEvent[] = [
    { date: '2026-05-01T09:00:00', user: 'Laura Restrepo', action: 'Carga inicial', objectName: 'Saldos iniciales', detail: 'Saldos iniciales de 6 cuentas al 01/05/2026' },
    { date: '2026-05-02T10:15:00', user: 'Laura Restrepo', action: 'Carga inicial', objectName: 'Google Drive', detail: '412 archivos encontrados, 398 cargados, 11 omitidos (duplicados), 3 fallidos' },
    { date: '2026-10-06T17:40:00', user: 'Carlos Mejía', action: 'Publicó cierre', objectName: 'Cierre septiembre 2026', detail: '6 cuentas conciliadas' },
  ]

  return { transactions, attachments, loans, obligations, tasks, history }
}

/** Cierres de septiembre ya publicados (saldoSistema se calcula al crear el estado inicial). */
export function septemberCloses(balance: (accountId: string) => number): MonthClose[] {
  return accounts.map((c) => {
    const s = balance(c.id)
    const gmf = c.bank === 'Bancolombia' ? -38_400 : 0
    return {
      id: `cierre-2026-09-${c.id}`, entityId: c.entityId, accountId: c.id, month: '2026-09',
      systemBalance: s, statementBalance: s + gmf,
      differences: gmf ? [{ amount: gmf, explanation: 'GMF (4 x 1.000) de septiembre, se registra en octubre' }] : [],
      status: 'published', reopenings: [], publishedAt: '2026-10-06T17:40:00',
    }
  })
}

/** Mensajes que ya están en la bandeja al iniciar la demo (la IA simulada los procesa al cargar). */
export const initialInbox = [
  { channel: 'whatsapp' as const, receivedAt: '2026-10-27T16:42:00', name: 'WhatsApp · Camila Ortiz', text: 'Le transferí 1.450.000 a la ferretería El Tornillo por materiales del taller desde el Banco B de la Empresa A' },
  { channel: 'whatsapp' as const, receivedAt: '2026-10-28T08:05:00', name: 'WhatsApp · Andrés Gómez', text: 'Nos consignaron 18,5 millones de Constructora Horizonte en Davivienda de la Empresa C por el acta de obra de Laureles' },
  { channel: 'email' as const, receivedAt: '2026-10-28T07:30:00', name: 'correo-proveedor.eml', file: 'correo-proveedor.eml' },
  { channel: 'whatsapp' as const, receivedAt: '2026-10-26T19:10:00', name: 'WhatsApp · Andrés Gómez', text: 'Ya le pagué lo del contador' },
]
