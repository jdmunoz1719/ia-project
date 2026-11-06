import { useEffect, useRef, useState, type DependencyList } from 'react'
import { api } from '@/services/api'

/** Ejecuta una consulta a los servicios y la repite cuando cambian los datos. Conserva el dato anterior mientras recarga. */
export function useServiceQuery<T>(fn: () => Promise<T>, deps: DependencyList = []) {
  const [data, setData] = useState<T>()
  const [error, setError] = useState<Error>()
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const fnRef = useRef(fn)
  fnRef.current = fn
  useEffect(() => api.subscribe(() => setTick((t) => t + 1)), [])
  useEffect(() => {
    let alive = true
    setLoading(true)
    fnRef.current().then((d) => { if (alive) { setData(d); setError(undefined) } }).catch((e) => alive && setError(e)).finally(() => alive && setLoading(false))
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])
  return { data, error, loading: loading && data === undefined, refreshing: loading }
}
