// Preferencias de interfaz (no son datos de negocio).
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type UI = { vista: string; incluirPersonales: boolean; setVista: (v: string) => void; setIncluirPersonales: (v: boolean) => void }
export const useUI = create<UI>()(persist((set) => ({
  vista: 'grupo', incluirPersonales: false,
  setVista: (vista) => set({ vista }), setIncluirPersonales: (incluirPersonales) => set({ incluirPersonales }),
}), { name: 'caja-clara-ui' }))
