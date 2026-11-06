import { useEffect, useRef, useState, type DependencyList } from 'react'
import { api } from '@/services/api'

/** Ejecuta una consulta a los servicios y la repite cuando cambian los datos. Conserva el dato anterior mientras recarga. */
export function useConsulta<T>(fn: () => Promise<T>, deps: DependencyList = []) {
  const [data, setData] = useState<T>()
  const [error, setError] = useState<Error>()
  const [cargando, setCargando] = useState(true)
  const [tick, setTick] = useState(0)
  const fnRef = useRef(fn)
  fnRef.current = fn
  useEffect(() => api.suscribir(() => setTick((t) => t + 1)), [])
  useEffect(() => {
    let vivo = true
    setCargando(true)
    fnRef.current().then((d) => { if (vivo) { setData(d); setError(undefined) } }).catch((e) => vivo && setError(e)).finally(() => vivo && setCargando(false))
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])
  return { data, error, cargando: cargando && data === undefined, recargando: cargando }
}
