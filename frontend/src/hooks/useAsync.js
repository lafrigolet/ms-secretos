import { useState, useEffect, useCallback } from 'react'

/**
 * useAsync — ejecuta una función async y gestiona loading/error/data.
 * Se re-ejecuta automáticamente cuando cambian las deps.
 */
export function useAsync (fn, deps = []) {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)

  const execute = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fn()
      setData(result)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, deps)

  useEffect(() => { execute() }, [execute])

  return { data, loading, error, refetch: execute }
}
