import React, { useRef, useEffect } from 'react'
import { parse, view as vegaView } from 'vega'
import { compile } from 'vega-lite'

export default function VegaChart({ spec, data = [] }) {
  const containerRef = useRef(null)
  const viewRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current) return

    try {
      if (viewRef.current) {
        viewRef.current.finalize()
        viewRef.current = null
      }

      let finalSpec = spec

      if (spec && spec.mark && !spec.$schema?.includes('vega/')) {
        const vlSpec = { ...spec, data: spec.data || { values: data.length ? data : undefined } }
        if (data.length && !vlSpec.data?.values) vlSpec.data = { values: data }
        finalSpec = compile(vlSpec, { noRedirect: true }).spec
      }

      if (!finalSpec) return

      if (data.length && !finalSpec.data?.values) {
        finalSpec.data = { values: data }
      }

      const vgSpec = typeof finalSpec === 'string' ? JSON.parse(finalSpec) : finalSpec
      const runtime = parse(vgSpec)
      const v = new vegaView(runtime)
        .logLevel(vegaView.Warn)
        .renderer('canvas')
        .initialize(containerRef.current)

      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        v.width(rect.width || 400).height(rect.height || 300)
      }

      v.runAsync().then(() => {
        viewRef.current = v
      }).catch(e => {
        console.warn('Vega render error:', e)
      })
    } catch (e) {
      console.warn('Vega spec error:', e)
      if (containerRef.current) {
        containerRef.current.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:200px;color:#9ca3af;font-size:12px">Invalid Vega spec: ${e.message}</div>`
      }
    }

    return () => {
      if (viewRef.current) {
        viewRef.current.finalize()
        viewRef.current = null
      }
    }
  }, [spec, data])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: 300 }}
      className="flex items-center justify-center"
    />
  )
}
