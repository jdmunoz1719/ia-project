// Punto de entrada de la "IA simulada": recibe un texto o archivo y devuelve el soporte (original intacto)
// y el ítem de bandeja con sus propuestas. No toca saldos: sólo propone.
import { buscarDuplicado } from '@/domain/agenda'
import type { Canal, Hecho, ItemBandeja, Soporte } from '@/domain/tipos'
import { extraerChatWhatsApp, extraerExtracto, extraerPropuestas, propuestaVacia, type ConfigIA } from './extractor'
import { ARCHIVOS_DEMO, hashTexto } from './predefinidas'

export type Entrada = {
  canal: Canal; recibidoEn: string; remitente?: string
  texto?: string
  archivo?: { nombre: string; tipoMime: string; tamano: number; contenidoTexto?: string; url?: string }
}

let n = 0
const id = (p: string) => `${p}-${Date.now().toString(36)}${(n++).toString(36)}`

export function procesarEntrada(e: Entrada, cfg: ConfigIA, existentes: { hechos: Hecho[]; soportes: Soporte[] }): { soporte: Soporte; item: ItemBandeja } {
  const demo = e.archivo && ARCHIVOS_DEMO.find((a) => a.nombre === e.archivo!.nombre)
  let textoExtraido = ''
  let propuestas
  let transcripcion = false

  if (!e.archivo) {
    textoExtraido = e.texto ?? ''
    propuestas = extraerPropuestas(textoExtraido, e.recibidoEn, cfg)
  } else if (demo) {
    textoExtraido = demo.textoExtraido
    transcripcion = demo.vista === 'audio'
    propuestas = demo.modo === 'chat' ? extraerChatWhatsApp(textoExtraido, cfg)
      : demo.modo === 'extracto' ? extraerExtracto(textoExtraido, demo.cuentaId!, cfg)
      : extraerPropuestas(textoExtraido, e.recibidoEn, cfg, demo.opciones)
  } else if (e.archivo.contenidoTexto) {
    textoExtraido = e.archivo.contenidoTexto
    const esChat = /^\d{1,2}\/\d{1,2}\/\d{2,4},?\s.+\s-\s[^:]+:/m.test(textoExtraido)
    propuestas = esChat ? extraerChatWhatsApp(textoExtraido, cfg) : extraerPropuestas(textoExtraido, e.recibidoEn, cfg)
  } else {
    propuestas = [propuestaVacia(e.recibidoEn)]
  }

  const contenido = e.archivo ? `${e.archivo.nombre}|${e.archivo.tamano}|${textoExtraido}` : textoExtraido
  const hash = hashTexto(contenido)
  const repetido = existentes.soportes.find((s) => s.hash === hash)

  const soporte: Soporte = {
    id: id('s'), hash, canal: e.canal, recibidoEn: e.recibidoEn,
    nombre: e.archivo?.nombre ?? (e.remitente ? `Mensaje de ${e.remitente}` : 'Mensaje de texto'),
    tipoMime: e.archivo?.tipoMime ?? 'text/plain', tamano: e.archivo?.tamano ?? new Blob([textoExtraido]).size,
    contenidoTexto: e.archivo ? (demo?.vista === 'texto' || e.archivo.contenidoTexto ? textoExtraido : undefined) : textoExtraido,
    urlMock: demo?.url ?? e.archivo?.url ?? '',
  }

  for (const p of propuestas) {
    if (p.tipo === 'tarea') continue
    const dup = buscarDuplicado(p, existentes.hechos)
    if (dup) { p.posibleDuplicadoDe = dup.id; p.confianza = Math.min(p.confianza, 55) }
  }

  const item: ItemBandeja = {
    id: id('b'), soporteId: soporte.id, estado: 'pendiente', propuestas, recibidoEn: e.recibidoEn, canal: e.canal,
    textoExtraido, transcripcion, archivoDuplicadoDe: repetido?.id,
  }
  return { soporte, item }
}

export const latenciaIA = () => 1500 + Math.random() * 1500
