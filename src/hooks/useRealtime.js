import { useState, useEffect, useRef, useCallback } from 'react'

export default function useRealtime(enabled = true) {
  const [connected, setConnected] = useState(false)
  const [matches, setMatches] = useState([])
  const [stats, setStats] = useState({ alertCount: 0, matchCount: 0, clients: 0 })
  const wsRef = useRef(null)
  const maxItems = 100

  useEffect(() => {
    if (!enabled) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const hostname = window.location.hostname
    const port = window.location.port || (protocol === 'wss:' ? 443 : 80)
    const url = `${protocol}//${hostname}:${port}/ws`
    let ws
    let reconnectTimer
    let retries = 0

    function connect() {
      ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => { setConnected(true); retries = 0 }
      ws.onclose = () => {
        setConnected(false)
        const delay = Math.min(1000 * Math.pow(2, retries), 30000)
        retries++
        reconnectTimer = setTimeout(connect, delay)
      }
      ws.onerror = () => ws?.close()

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'status') {
            setConnected(true)
            setStats({ alertCount: data.alertCount || 0, matchCount: data.matchCount || 0, clients: data.clients || 0 })
          }
          if (data.type === 'alert' || data.type === 'match') {
            setMatches(prev => [{ ...data, id: data.id || Date.now() }, ...prev].slice(0, maxItems))
            setStats(s => ({ ...s, alertCount: data.id || s.alertCount + 1, matchCount: data.type === 'match' ? (s.matchCount + 1) : s.matchCount }))
          }
          if (data.type === 'pong') {}
        } catch {}
      }
    }

    connect()
    return () => { if (ws) ws.close() }
  }, [enabled])

  const clearMatches = useCallback(() => setMatches([]), [])

  return { connected, matches, stats, clearMatches }
}
