// Preferencias de interfaz (no son datos de negocio).
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type UI = { view: string; includePersonal: boolean; setView: (v: string) => void; setIncludePersonal: (v: boolean) => void }
export const useUI = create<UI>()(persist((set) => ({
  view: 'group', includePersonal: false,
  setView: (view) => set({ view }), setIncludePersonal: (includePersonal) => set({ includePersonal }),
}), { name: 'caja-clara-ui' }))
