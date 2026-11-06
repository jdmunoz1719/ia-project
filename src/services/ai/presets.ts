// "IA simulada", capa 2: respuestas predefinidas para archivos (sin OCR ni transcripción real).
// El texto "extraído" pasa por el mismo extractor de reglas, así la evidencia apunta al contenido.
import type { Channel } from '@/domain/types'
import type { AiOptions } from './extractor'

export type DemoFile = {
  name: string; mimeType: string; size: number; url: string; description: string; channel: Channel
  view: 'image' | 'pdf' | 'audio' | 'text' | 'table' | 'email'
  extractedText: string; mode: 'text' | 'chat' | 'statement'; options?: AiOptions; accountId?: string
}

export const DEMO_FILES: DemoFile[] = [
  {
    name: 'recibo-arriendo-bodega.jpg', mimeType: 'image/jpeg', size: 214_380, url: '/demo/recibo-arriendo-bodega.jpg', channel: 'whatsapp',
    description: 'Foto de un recibo de caja', view: 'image', mode: 'text', options: { singleRecord: true, type: 'expense' },
    extractedText: 'RECIBO DE CAJA No. 0847\nInversiones Ríos S.A.S. — NIT 900.412.775-3\nFecha: 28/10/2026\nRecibimos de: Empresa B, por cuenta de Empresa A\nLa suma de: $2.350.000\nConcepto: Arriendo de la bodega, mes de octubre de 2026\nForma de pago: Transferencia desde Bancolombia',
  },
  {
    name: 'factura-servicios.pdf', mimeType: 'application/pdf', size: 96_512, url: '/demo/factura-servicios.pdf', channel: 'email',
    description: 'Factura de servicios públicos', view: 'pdf', mode: 'text', options: { singleRecord: true, type: 'task', taskTitle: 'Pagar factura de servicios públicos EPM (local Empresa B)' },
    extractedText: 'EPM — Empresas Públicas\nFACTURA DE SERVICIOS PÚBLICOS\nCliente: Empresa B — Local comercial\nPeriodo facturado: septiembre de 2026\nEnergía 412 kWh · Acueducto 18 m³\nFecha límite de pago: 05/11/2026\nTotal a pagar: $ 712.480',
  },
  {
    name: 'nota-de-voz-taller.ogg', mimeType: 'audio/ogg', size: 182_000, url: '/demo/nota-de-voz-taller.ogg', channel: 'whatsapp',
    description: 'Nota de voz por WhatsApp', view: 'audio', mode: 'text',
    extractedText: 'Hola, te cuento que antier le pagué a Transportes Rápido Sur 350 mil por el flete de la bodega, eso salió del Banco B. Y el viernes toca pagar la quincena del taller.',
  },
  {
    name: 'chat-whatsapp-socios.txt', mimeType: 'text/plain', size: 1_024, url: '/demo/chat-whatsapp-socios.txt', channel: 'whatsapp_export',
    description: 'Chat exportado de WhatsApp', view: 'text', mode: 'chat', extractedText: '',
  },
  {
    name: 'extracto-bancolombia-oct.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 18_944, url: '/demo/extracto-bancolombia-oct.xlsx', channel: 'email',
    description: 'Extracto bancario en Excel', view: 'table', mode: 'statement', accountId: 'cta-bancolombia',
    extractedText: [
      '02/10/2026  TRANSF RECIBIDA DAVIVIENDA EMP C  +1.500.000',
      '03/10/2026  GMF 4X1000  -38.400',
      '15/10/2026  PAGO CUOTA LEASING 0042  -2.032.870',
      '24/10/2026  CONSIGNACION CLIENTE ALMACEN  +5.640.000',
      '25/10/2026  COMISION TRANSFERENCIAS  -14.280',
    ].join('\n'),
  },
  {
    name: 'correo-proveedor.eml', mimeType: 'message/rfc822', size: 4_310, url: '/demo/correo-proveedor.eml', channel: 'email',
    description: 'Correo de un proveedor', view: 'email', mode: 'text', options: { singleRecord: true, type: 'cost' },
    extractedText: 'De: Facturación Concretos del Valle <facturacion@concretosdelvalle.co>\nPara: bandeja@cajaclara.co\nAsunto: Confirmación de pago recibido – Factura FE-20931\nFecha: 27/10/2026\n\nBuen día,\n\nConfirmamos que recibimos su pago por $ 4.870.000 correspondiente a la factura FE-20931 de concreto premezclado para la Obra Laureles, realizado desde su cuenta Davivienda.\n\nAdjuntamos el soporte de pago.\n\nCordialmente,\nÁrea de cartera — Concretos del Valle S.A.',
  },
]

export const PARTNERS_CHAT = [
  '02/10/26, 7:48 a. m. - Laura Restrepo: Ayer pagué 3.800.000 del arriendo del local desde Bancolombia de la Empresa B',
  '02/10/26, 7:50 a. m. - Andrés Gómez: Perfecto 👍',
  '20/10/26, 7:52 a. m. - Andrés Gómez: Buenos días. Ayer recibí 4.200.000 de Comercializadora Nova en Banco B de la Empresa A por el servicio del taller',
  '22/10/26, 11:05 a. m. - Andrés Gómez: Pasé 2 millones de Bancolombia de la Empresa B a Davivienda de la Empresa C para la obra',
  '23/10/26, 6:40 p. m. - Camila Ortiz: Gasté 185 mil en peajes y gasolina de la camioneta de la Empresa D desde el Banco de Bogotá',
  '24/10/26, 8:02 a. m. - Andrés Gómez: Toca pagar la administración del edificio de la Empresa E el 10',
].join('\n')
DEMO_FILES.find((a) => a.mode === 'chat')!.extractedText = PARTNERS_CHAT

/** Mensajes que "llegan" por WhatsApp o correo conectados (Ctrl+Shift+W / Ctrl+Shift+E). */
export const INCOMING_MESSAGES = {
  whatsapp: [
    { from: 'Camila Ortiz', text: 'Hoy pagué 486.000 de servicios públicos de la oficina desde el Banco de Bogotá de la Empresa D' },
    { from: 'Andrés Gómez', text: 'Nos consignaron 6,2 millones de Distribuidora Andina en Bancolombia de la Empresa B. Mañana toca pagar la nómina de la Empresa C' },
    { from: 'Laura Restrepo', text: 'Ayer gasté 230 mil en el arreglo de la puerta del local de la Empresa E desde la caja de la E' },
  ],
  email: [
    { from: 'cartera@ferreteriaeltornillo.co', subject: 'Soporte de pago – Pedido 3381', text: 'Recibimos su transferencia por $ 1.268.000 del pedido 3381 de materiales para el taller, desde Banco B de la Empresa A, el 27/10/2026.' },
  ],
}

/** Hash simple (FNV-1a) para detectar archivos repetidos. */
export function hashText(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) }
  return (h >>> 0).toString(16).padStart(8, '0')
}
