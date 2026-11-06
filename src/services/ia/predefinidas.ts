// "IA simulada", capa 2: respuestas predefinidas para archivos (sin OCR ni transcripción real).
// El texto "extraído" pasa por el mismo extractor de reglas, así la evidencia apunta al contenido.
import type { Canal } from '@/domain/tipos'
import type { OpcionesIA } from './extractor'

export type ArchivoDemo = {
  nombre: string; tipoMime: string; tamano: number; url: string; descripcion: string; canal: Canal
  vista: 'imagen' | 'pdf' | 'audio' | 'texto' | 'tabla' | 'correo'
  textoExtraido: string; modo: 'texto' | 'chat' | 'extracto'; opciones?: OpcionesIA; cuentaId?: string
}

export const ARCHIVOS_DEMO: ArchivoDemo[] = [
  {
    nombre: 'recibo-arriendo-bodega.jpg', tipoMime: 'image/jpeg', tamano: 214_380, url: '/demo/recibo-arriendo-bodega.jpg', canal: 'whatsapp',
    descripcion: 'Foto de un recibo de caja', vista: 'imagen', modo: 'texto', opciones: { unSoloRegistro: true, tipo: 'gasto' },
    textoExtraido: 'RECIBO DE CAJA No. 0847\nInversiones Ríos S.A.S. — NIT 900.412.775-3\nFecha: 28/10/2026\nRecibimos de: Empresa B, por cuenta de Empresa A\nLa suma de: $2.350.000\nConcepto: Arriendo de la bodega, mes de octubre de 2026\nForma de pago: Transferencia desde Bancolombia',
  },
  {
    nombre: 'factura-servicios.pdf', tipoMime: 'application/pdf', tamano: 96_512, url: '/demo/factura-servicios.pdf', canal: 'correo',
    descripcion: 'Factura de servicios públicos', vista: 'pdf', modo: 'texto', opciones: { unSoloRegistro: true, tipo: 'tarea', tituloTarea: 'Pagar factura de servicios públicos EPM (local Empresa B)' },
    textoExtraido: 'EPM — Empresas Públicas\nFACTURA DE SERVICIOS PÚBLICOS\nCliente: Empresa B — Local comercial\nPeriodo facturado: septiembre de 2026\nEnergía 412 kWh · Acueducto 18 m³\nFecha límite de pago: 05/11/2026\nTotal a pagar: $ 712.480',
  },
  {
    nombre: 'nota-de-voz-taller.ogg', tipoMime: 'audio/ogg', tamano: 182_000, url: '/demo/nota-de-voz-taller.ogg', canal: 'whatsapp',
    descripcion: 'Nota de voz por WhatsApp', vista: 'audio', modo: 'texto',
    textoExtraido: 'Hola, te cuento que antier le pagué a Transportes Rápido Sur 350 mil por el flete de la bodega, eso salió del Banco B. Y el viernes toca pagar la quincena del taller.',
  },
  {
    nombre: 'chat-whatsapp-socios.txt', tipoMime: 'text/plain', tamano: 1_024, url: '/demo/chat-whatsapp-socios.txt', canal: 'whatsapp_export',
    descripcion: 'Chat exportado de WhatsApp', vista: 'texto', modo: 'chat', textoExtraido: '',
  },
  {
    nombre: 'extracto-bancolombia-oct.xlsx', tipoMime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', tamano: 18_944, url: '/demo/extracto-bancolombia-oct.xlsx', canal: 'correo',
    descripcion: 'Extracto bancario en Excel', vista: 'tabla', modo: 'extracto', cuentaId: 'cta-bancolombia',
    textoExtraido: [
      '02/10/2026  TRANSF RECIBIDA DAVIVIENDA EMP C  +1.500.000',
      '03/10/2026  GMF 4X1000  -38.400',
      '15/10/2026  PAGO CUOTA LEASING 0042  -2.032.870',
      '24/10/2026  CONSIGNACION CLIENTE ALMACEN  +5.640.000',
      '25/10/2026  COMISION TRANSFERENCIAS  -14.280',
    ].join('\n'),
  },
  {
    nombre: 'correo-proveedor.eml', tipoMime: 'message/rfc822', tamano: 4_310, url: '/demo/correo-proveedor.eml', canal: 'correo',
    descripcion: 'Correo de un proveedor', vista: 'correo', modo: 'texto', opciones: { unSoloRegistro: true, tipo: 'costo' },
    textoExtraido: 'De: Facturación Concretos del Valle <facturacion@concretosdelvalle.co>\nPara: bandeja@cajaclara.co\nAsunto: Confirmación de pago recibido – Factura FE-20931\nFecha: 27/10/2026\n\nBuen día,\n\nConfirmamos que recibimos su pago por $ 4.870.000 correspondiente a la factura FE-20931 de concreto premezclado para la Obra Laureles, realizado desde su cuenta Davivienda.\n\nAdjuntamos el soporte de pago.\n\nCordialmente,\nÁrea de cartera — Concretos del Valle S.A.',
  },
]

export const CHAT_SOCIOS = [
  '02/10/26, 7:48 a. m. - Laura Restrepo: Ayer pagué 3.800.000 del arriendo del local desde Bancolombia de la Empresa B',
  '02/10/26, 7:50 a. m. - Andrés Gómez: Perfecto 👍',
  '20/10/26, 7:52 a. m. - Andrés Gómez: Buenos días. Ayer recibí 4.200.000 de Comercializadora Nova en Banco B de la Empresa A por el servicio del taller',
  '22/10/26, 11:05 a. m. - Andrés Gómez: Pasé 2 millones de Bancolombia de la Empresa B a Davivienda de la Empresa C para la obra',
  '23/10/26, 6:40 p. m. - Camila Ortiz: Gasté 185 mil en peajes y gasolina de la camioneta de la Empresa D desde el Banco de Bogotá',
  '24/10/26, 8:02 a. m. - Andrés Gómez: Toca pagar la administración del edificio de la Empresa E el 10',
].join('\n')
ARCHIVOS_DEMO.find((a) => a.modo === 'chat')!.textoExtraido = CHAT_SOCIOS

/** Mensajes que "llegan" por WhatsApp o correo conectados (Ctrl+Shift+W / Ctrl+Shift+E). */
export const MENSAJES_ENTRANTES = {
  whatsapp: [
    { de: 'Camila Ortiz', texto: 'Hoy pagué 486.000 de servicios públicos de la oficina desde el Banco de Bogotá de la Empresa D' },
    { de: 'Andrés Gómez', texto: 'Nos consignaron 6,2 millones de Distribuidora Andina en Bancolombia de la Empresa B. Mañana toca pagar la nómina de la Empresa C' },
    { de: 'Laura Restrepo', texto: 'Ayer gasté 230 mil en el arreglo de la puerta del local de la Empresa E desde la caja de la E' },
  ],
  correo: [
    { de: 'cartera@ferreteriaeltornillo.co', asunto: 'Soporte de pago – Pedido 3381', texto: 'Recibimos su transferencia por $ 1.268.000 del pedido 3381 de materiales para el taller, desde Banco B de la Empresa A, el 27/10/2026.' },
  ],
}

/** Hash simple (FNV-1a) para detectar archivos repetidos. */
export function hashTexto(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) }
  return (h >>> 0).toString(16).padStart(8, '0')
}
