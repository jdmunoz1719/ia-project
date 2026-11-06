// Estado de la demo (Zustand + localStorage). Sólo lo usan los servicios mock, nunca las pantallas.
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import * as seed from '@/data/seed'
import { expandirTodos, saldoCuenta } from '@/domain/libro'
import type {
  Categoria, Cierre, Credito, Cuenta, Entidad, EventoHistorial, Hecho, ItemBandeja, Obligacion,
  Proyecto, Responsable, Rol, Soporte, Tarea, Tercero,
} from '@/domain/tipos'
import { procesarEntrada } from '@/services/ia'
import { ARCHIVOS_DEMO } from '@/services/ia/predefinidas'

export type Usuario = { nombre: string; email: string; rol: Rol; entidadIds?: string[] }

export type EstadoDemo = {
  version: number
  hoy: string
  sesion: { usuario: Usuario | null; verificado: boolean }
  entidades: Entidad[]; cuentas: Cuenta[]; proyectos: Proyecto[]; categorias: Categoria[]
  terceros: Tercero[]; responsables: Responsable[]
  hechos: Hecho[]; soportes: Soporte[]; bandeja: ItemBandeja[]
  creditos: Credito[]; obligaciones: Obligacion[]; tareas: Tarea[]; cierres: Cierre[]
  historial: EventoHistorial[]; pospuestas: Record<string, string>
  entrantes: { whatsapp: number; correo: number }
}

export const VERSION_DATOS = 3

export function estadoInicial(): EstadoDemo {
  const g = seed.generarSemilla()
  const lineas = expandirTodos(g.hechos, seed.cuentas)
  const cierres = seed.cierresSeptiembre((id) => saldoCuenta(seed.cuentas.find((c) => c.id === id)!, lineas, '2026-09-30'))
  const cfg = { ...seed, creditos: g.creditos }
  const soportes = [...g.soportes]
  const bandeja: ItemBandeja[] = []
  for (const b of seed.bandejaInicial) {
    const demo = 'archivo' in b ? ARCHIVOS_DEMO.find((a) => a.nombre === b.archivo) : undefined
    const { soporte, item } = procesarEntrada({
      canal: b.canal, recibidoEn: b.recibidoEn, remitente: b.nombre.replace('WhatsApp · ', ''),
      texto: 'texto' in b ? b.texto : undefined,
      archivo: demo && { nombre: demo.nombre, tipoMime: demo.tipoMime, tamano: demo.tamano },
    }, cfg, { hechos: g.hechos, soportes })
    soportes.push(soporte); bandeja.unshift(item)
  }
  return {
    version: VERSION_DATOS, hoy: seed.HOY_DEMO, sesion: { usuario: null, verificado: false },
    entidades: seed.entidades, cuentas: seed.cuentas, proyectos: seed.proyectos, categorias: seed.categorias,
    terceros: seed.terceros, responsables: seed.responsables,
    hechos: g.hechos, soportes, bandeja, creditos: g.creditos, obligaciones: g.obligaciones, tareas: g.tareas,
    cierres, historial: g.historial, pospuestas: {}, entrantes: { whatsapp: 0, correo: 0 },
  }
}

export const useDemo = create<EstadoDemo>()(
  persist(() => estadoInicial(), {
    name: 'caja-clara-demo',
    version: VERSION_DATOS,
    migrate: () => estadoInicial(),
  }),
)
