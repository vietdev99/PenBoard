import { useState, useEffect, useCallback } from 'react'
import type { FlowFile } from '@/types/pen'

export { type FlowFile }

export function useFlowData() {
  const [flows, setFlows] = useState<FlowFile[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchFlows = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${window.location.origin}/api/workspace/flows`)
      if (!res.ok) throw new Error(`Failed to fetch flows: ${res.status}`)
      const data = (await res.json()) as { flows: FlowFile[]; error?: string }
      setFlows(data.flows)
      if (data.error) setError(data.error)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load flows')
      setFlows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFlows()
  }, [fetchFlows])

  return { flows, loading, error, refresh: fetchFlows }
}
