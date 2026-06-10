import { useCallback, useRef, useState } from 'react'

export function usePanelLoader() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const hasLoadedRef = useRef(false)

  const run = useCallback(async (task: () => Promise<void>) => {
    if (hasLoadedRef.current) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    try {
      await task()
      hasLoadedRef.current = true
    } catch (error) {
      throw error
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  return { loading, refreshing, run }
}
