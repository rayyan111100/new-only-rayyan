import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
// dark-mode-only: theme context not needed on login page

const TOPO_URL = 'https://unpkg.com/world-atlas@2/countries-110m.json'

function orthoProject(lon, lat, rotLon, rotLat) {
  const toRad = Math.PI / 180
  const l = (lon + rotLon) * toRad
  const p = lat * toRad
  const rl = rotLat * toRad
  const sinP = Math.sin(p), cosP = Math.cos(p)
  const sinL = Math.sin(l), cosL = Math.cos(l)
  const sinRL = Math.sin(rl), cosRL = Math.cos(rl)
  const x3 = cosP * sinL
  const y3 = sinP * cosRL - cosP * cosL * sinRL
  const z3 = sinP * sinRL + cosP * cosL * cosRL
  if (z3 < 0) return null
  const lx = -0.45, ly = -0.6, lz = 0.66
  const lc = Math.max(0, x3 * lx + y3 * ly + z3 * lz)
  return { x: x3, y: -y3, z: z3, lc }
}

function drawRing(ctx, coords, R, cx, cy, rotLon, rotLat) {
  let started = false
  for (const [lon, lat] of coords) {
    const pt = orthoProject(lon, lat, rotLon, rotLat)
    if (!pt) { started = false; continue }
    const px = cx + pt.x * R, py = cy + pt.y * R
    if (!started) { ctx.moveTo(px, py); started = true }
    else ctx.lineTo(px, py)
  }
}

function shadeColor(r, g, b, lc) { return `rgba(${Math.round(r*lc)},${Math.round(g*lc)},${Math.round(b*lc)},0.85)` }

export default function LoginPage() {
  const navigate = useNavigate()
  const { login, user } = useAuth()
  const isDark = true

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [topoData, setTopoData] = useState(null)
  const [topoLoading, setTopoLoading] = useState(true)

  const globeCanvasRef = useRef(null)
  const globeWrapRef = useRef(null)
  const bgCanvasRef = useRef(null)
  const loginWrapRef = useRef(null)
  const alertBoxRef = useRef(null)
  const lockShackleRef = useRef(null)
  const lockLabelRef = useRef(null)
  const lockRingRef = useRef(null)
  const pwIcoRef = useRef(null)
  const userRef = useRef(null)
  const passRef = useRef(null)
  const userWrapRef = useRef(null)
  const passWrapRef = useRef(null)
  const userFieldRef = useRef(null)
  const passFieldRef = useRef(null)
  const sbtnRef = useRef(null)
  const globeRAF = useRef(null)
  const bgRAF = useRef(null)
  const rotLon = useRef(0)

  const errUserRef = useRef(null)
  const errPassRef = useRef(null)

  // Redirect if already authenticated
  useEffect(() => {
    if (user) navigate('/', { replace: true })
  }, [user, navigate])

  // Load topojson data
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(TOPO_URL)
        const data = await res.json()
        if (!cancelled) { setTopoData(data); setTopoLoading(false) }
      } catch {
        if (!cancelled) setTopoLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  function topoFeatures(topo, name) {
    if (!topo || !topo.objects) return []
    const obj = topo.objects[name]
    if (!obj) return []
    const [sx, sy] = topo.transform.scale
    const [tx, ty] = topo.transform.translate

    function decodeArc(arc) {
      let x = 0, y = 0
      return arc.map(([dx, dy]) => { x += dx; y += dy; return [x * sx + tx, y * sy + ty] })
    }

    function decodeArcIdx(idx) {
      if (idx < 0) { const r = decodeArc(topo.arcs[~idx]); r.reverse(); return r }
      return decodeArc(topo.arcs[idx])
    }

    function ringCoords(arcIdxList) {
      let pts = []
      for (const idx of arcIdxList) {
        const seg = decodeArcIdx(idx)
        if (pts.length > 0) seg.shift()
        pts = pts.concat(seg)
      }
      return pts
    }

    function geomToGeoJSON(geom) {
      if (!geom) return null
      if (geom.type === 'Polygon') return { type: 'Feature', geometry: { type: 'Polygon', coordinates: geom.arcs.map(ring => ringCoords(ring)) }, id: geom.id }
      if (geom.type === 'MultiPolygon') return { type: 'Feature', geometry: { type: 'MultiPolygon', coordinates: geom.arcs.map(poly => poly.map(ring => ringCoords(ring))) }, id: geom.id }
      return null
    }

    return obj.geometries.map(geomToGeoJSON).filter(Boolean)
  }

  // Globe renderer
  useEffect(() => {
    if (topoLoading) return
    const features = topoData ? topoFeatures(topoData, 'countries') : []

    function drawGlobe() {
      const wrap = globeWrapRef.current
      if (!wrap) { globeRAF.current = requestAnimationFrame(drawGlobe); return }
      const size = wrap.offsetWidth
      if (!size) { globeRAF.current = requestAnimationFrame(drawGlobe); return }

      const canvas = globeCanvasRef.current
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      if (canvas.width !== size * dpr) { canvas.width = size * dpr; canvas.height = size * dpr }

      const ctx = canvas.getContext('2d')
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const cx = size / 2, cy = size / 2, R = size / 2 - 2

      ctx.clearRect(0, 0, size, size)

      // Ocean gradient
      const hx = cx - R * 0.32, hy = cy - R * 0.32
      const oceanGrad = ctx.createRadialGradient(hx, hy, R * 0.04, cx, cy, R)
      if (isDark) {
        oceanGrad.addColorStop(0, '#1a3a5c')
        oceanGrad.addColorStop(0.35, '#0c1f35')
        oceanGrad.addColorStop(0.7, '#060f1c')
        oceanGrad.addColorStop(1, '#020609')
      } else {
        oceanGrad.addColorStop(0, '#c8e8f8')
        oceanGrad.addColorStop(0.35, '#8ec8e8')
        oceanGrad.addColorStop(0.7, '#5aaad0')
        oceanGrad.addColorStop(1, '#2d6e99')
      }
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.fillStyle = oceanGrad
      ctx.fill()

      // Limb darkening
      const limb = ctx.createRadialGradient(cx, cy, R * 0.55, cx, cy, R)
      limb.addColorStop(0, 'transparent')
      limb.addColorStop(1, isDark ? 'rgba(0,0,0,0.72)' : 'rgba(30,60,100,0.38)')
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.fillStyle = limb
      ctx.fill()

      // Grid lines
      for (let lat = -60; lat <= 60; lat += 30) {
        ctx.beginPath()
        let first = true
        for (let lon = -180; lon <= 180; lon += 2) {
          const pt = orthoProject(lon, lat, rotLon.current, 20)
          if (!pt) { first = true; continue }
          const px = cx + pt.x * R, py = cy + pt.y * R
          const a = isDark ? (0.04 + pt.lc * 0.1) : (0.12 + pt.lc * 0.16)
          ctx.strokeStyle = isDark ? `rgba(62,198,255,${a})` : `rgba(30,90,160,${a})`
          ctx.lineWidth = 0.5
          if (first) { ctx.moveTo(px, py); first = false }
          else { ctx.lineTo(px, py); ctx.stroke(); ctx.beginPath(); ctx.moveTo(px, py) }
        }
        ctx.stroke()
      }
      for (let lon = -150; lon <= 180; lon += 30) {
        ctx.beginPath()
        let first = true
        for (let lat = -90; lat <= 90; lat += 2) {
          const pt = orthoProject(lon, lat, rotLon.current, 20)
          if (!pt) { first = true; continue }
          const px = cx + pt.x * R, py = cy + pt.y * R
          const a = isDark ? (0.04 + pt.lc * 0.1) : (0.12 + pt.lc * 0.16)
          ctx.strokeStyle = isDark ? `rgba(62,198,255,${a})` : `rgba(30,90,160,${a})`
          ctx.lineWidth = 0.5
          if (first) { ctx.moveTo(px, py); first = false }
          else { ctx.lineTo(px, py); ctx.stroke(); ctx.beginPath(); ctx.moveTo(px, py) }
        }
        ctx.stroke()
      }

      // Countries
      if (features.length > 0) {
        features.forEach(feat => {
          if (!feat || !feat.geometry) return
          const geom = feat.geometry
          const polys = geom.type === 'MultiPolygon' ? geom.coordinates : [geom.coordinates]
          let lcSum = 0, lcN = 0
          polys.forEach(poly => {
            const ring = poly[0]
            const step = Math.max(1, Math.floor(ring.length / 6))
            for (let i = 0; i < ring.length; i += step) {
              const pt = orthoProject(ring[i][0], ring[i][1], rotLon.current, 20)
              if (pt) { lcSum += pt.lc; lcN++ }
            }
          })
          const lc = lcN > 0 ? lcSum / lcN : 0
          if (lc === 0) return

          let fillColor, strokeColor
          if (isDark) {
            fillColor = `rgba(${Math.round(lc*56)},${Math.round(lc*107)},${Math.round((0.08+lc*0.38)*255)},0.85)`
            strokeColor = `rgba(62,198,255,${0.25+lc*0.45})`
          } else {
            const shade = 0.45 + lc * 0.55
            fillColor = `rgba(${Math.round(shade*180)},${Math.round(shade*200)},${Math.round(shade*160)},0.92)`
            strokeColor = `rgba(30,70,120,${0.3+lc*0.4})`
          }

          ctx.beginPath()
          polys.forEach(poly => poly.forEach(ring => drawRing(ctx, ring, R, cx, cy, rotLon.current, 20)))
          ctx.fillStyle = fillColor
          ctx.fill()

          ctx.beginPath()
          polys.forEach(poly => poly.forEach(ring => drawRing(ctx, ring, R, cx, cy, rotLon.current, 20)))
          ctx.strokeStyle = strokeColor
          ctx.lineWidth = 0.65
          ctx.stroke()
        })
      }

      // Clip
      ctx.save()
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.clip()

      // Hot spots
      const spots = [
        [55.3, 25.2, '#ff5fa8'], [-43.2, -22.9, '#ffb454'], [77.1, 28.6, '#3ec6ff'],
        [37.6, 55.7, '#a371f7'], [2.3, 48.8, '#ff5fa8'], [12.5, 41.9, '#ffb454'],
        [-74.0, 40.7, '#3ec6ff'], [-87.6, 41.9, '#ff5fa8'], [116.4, 39.9, '#a371f7'],
        [139.7, 35.7, '#3ec6ff'], [-0.1, 51.5, '#ffb454'], [18.4, -33.9, '#ff5fa8'],
        [28.0, -26.2, '#a371f7'], [-47.9, -15.8, '#3ec6ff'], [103.8, 1.4, '#ffb454'],
        [151.2, -33.9, '#ff5fa8'], [144.9, -37.8, '#a371f7'], [24.9, 60.2, '#3ec6ff'],
        [-3.7, 40.4, '#ffb454'], [19.0, 47.5, '#ff5fa8'], [14.4, 50.1, '#3ec6ff']
      ]
      const t = Date.now() / 1000
      spots.forEach(([lon, lat, col], i) => {
        const pt = orthoProject(lon, lat, rotLon.current, 20)
        if (!pt) return
        const px = cx + pt.x * R, py = cy + pt.y * R
        const pulse = 0.5 + 0.5 * Math.sin(t * 1.8 + i * 0.7)
        ctx.beginPath()
        ctx.arc(px, py, 3 + pulse * 8, 0, Math.PI * 2)
        ctx.strokeStyle = col + Math.floor(pulse * 0.6 * 255).toString(16).padStart(2, '0')
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(px, py, 2.5, 0, Math.PI * 2)
        ctx.fillStyle = col
        ctx.fill()
      })

      // Connection arcs
      const connPairs = [[0, 6], [1, 8], [2, 3], [3, 10], [4, 5], [6, 10], [7, 9], [8, 11], [12, 15], [13, 18], [14, 16], [0, 2], [5, 12], [9, 13]]
      const arcSpeed = (t * 0.18) % 1
      connPairs.forEach(([ai, bi], ci) => {
        if (ai >= spots.length || bi >= spots.length) return
        const ptA = orthoProject(spots[ai][0], spots[ai][1], rotLon.current, 20)
        const ptB = orthoProject(spots[bi][0], spots[bi][1], rotLon.current, 20)
        if (!ptA || !ptB) return
        const pAx = cx + ptA.x * R, pAy = cy + ptA.y * R
        const pBx = cx + ptB.x * R, pBy = cy + ptB.y * R
        const midLon = (spots[ai][0] + spots[bi][0]) / 2
        const midLat = (spots[ai][1] + spots[bi][1]) / 2 + 18
        const ptM = orthoProject(midLon, midLat, rotLon.current, 20)
        if (!ptM) return
        const pMx = cx + ptM.x * R, pMy = cy + ptM.y * R
        ctx.beginPath()
        ctx.moveTo(pAx, pAy)
        ctx.quadraticCurveTo(pMx, pMy, pBx, pBy)
        ctx.strokeStyle = isDark
          ? `rgba(62,198,255,${0.18 + 0.07 * Math.sin(t + ci)})`
          : `rgba(30,90,200,${0.28 + 0.1 * Math.sin(t + ci)})`
        ctx.lineWidth = 0.9
        ctx.stroke()
        const phase = (arcSpeed + ci * 0.53) % 1
        const bx = (1 - phase) * (1 - phase) * pAx + 2 * (1 - phase) * phase * pMx + phase * phase * pBx
        const by = (1 - phase) * (1 - phase) * pAy + 2 * (1 - phase) * phase * pMy + phase * phase * pBy
        ctx.beginPath(); ctx.arc(bx, by, 2.8, 0, Math.PI * 2)
        ctx.fillStyle = spots[ai][2]; ctx.fill()
        ctx.beginPath(); ctx.arc(bx, by, 5.5, 0, Math.PI * 2)
        ctx.fillStyle = spots[ai][2] + '44'; ctx.fill()
      })

      ctx.restore()

      // Atmosphere
      const atm = ctx.createRadialGradient(cx, cy, R - 2, cx, cy, R + 14)
      if (isDark) {
        atm.addColorStop(0, 'rgba(62,198,255,0.22)')
        atm.addColorStop(0.6, 'rgba(62,198,255,0.08)')
        atm.addColorStop(1, 'transparent')
      } else {
        atm.addColorStop(0, 'rgba(100,180,255,0.30)')
        atm.addColorStop(0.6, 'rgba(100,160,240,0.12)')
        atm.addColorStop(1, 'transparent')
      }
      ctx.beginPath()
      ctx.arc(cx, cy, R + 14, 0, Math.PI * 2)
      ctx.fillStyle = atm
      ctx.fill()

      // Specular
      const sx = cx - R * 0.30, sy = cy - R * 0.30
      const spec = ctx.createRadialGradient(sx, sy, 1, sx, sy, R * 0.52)
      spec.addColorStop(0, isDark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.55)')
      spec.addColorStop(0.4, isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.18)')
      spec.addColorStop(1, 'transparent')
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.fillStyle = spec
      ctx.fill()

      // Border
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(232,104,26,${isDark ? 0.38 : 0.55})`
      ctx.lineWidth = 1.5
      ctx.stroke()

      rotLon.current = ((rotLon.current - 0.25) % 360)
      globeRAF.current = requestAnimationFrame(drawGlobe)
    }

    globeRAF.current = requestAnimationFrame(drawGlobe)
    return () => { if (globeRAF.current) cancelAnimationFrame(globeRAF.current) }
  }, [topoLoading, topoData])

  // Background particle canvas
  useEffect(() => {
    const c = bgCanvasRef.current
    if (!c) return
    let W, H, ctx2, nodes = []
    function resize() { W = c.width = window.innerWidth; H = c.height = window.innerHeight }
    function rnd(a, b) { return a + Math.random() * (b - a) }
    function init() {
      nodes = []
      const N = Math.min(32, Math.floor(W / 42))
      for (let i = 0; i < N; i++) {
        nodes.push({
          x: rnd(0, W), y: rnd(0, H), vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
          r: rnd(2, 4.5), ph: rnd(0, Math.PI * 2), type: ['o', 'p', 'r'][Math.floor(Math.random() * 3)]
        })
      }
    }
    function draw2() {
      ctx2.clearRect(0, 0, W, H)
      const t = Date.now() / 1000
      ctx2.fillStyle = isDark ? '#0b0f16' : '#f2f0ec'
      ctx2.fillRect(0, 0, W, H)
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y, d = Math.sqrt(dx * dx + dy * dy)
          if (d < 110) {
            ctx2.beginPath(); ctx2.moveTo(nodes[i].x, nodes[i].y); ctx2.lineTo(nodes[j].x, nodes[j].y)
            ctx2.strokeStyle = `rgba(232,104,26,${(1 - d / 110) * (isDark ? 0.13 : 0.08)})`
            ctx2.lineWidth = 0.7; ctx2.stroke()
          }
        }
      }
      nodes.forEach(n => {
        const p = 0.5 + 0.5 * Math.sin(t * 1.3 + n.ph)
        n.x += n.vx; n.y += n.vy
        if (n.x < 0 || n.x > W) n.vx *= -1
        if (n.y < 0 || n.y > H) n.vy *= -1
        ctx2.beginPath(); ctx2.arc(n.x, n.y, n.r + 2 + p * 3, 0, Math.PI * 2)
        ctx2.fillStyle = `rgba(232,104,26,${p * (isDark ? 0.05 : 0.03)})`; ctx2.fill()
        ctx2.beginPath(); ctx2.arc(n.x, n.y, n.r, 0, Math.PI * 2)
        const cols = { o: `rgba(232,104,26,${isDark ? 0.7 : 0.55})`, p: `rgba(163,113,247,${isDark ? 0.6 : 0.5})`, r: `rgba(248,81,73,${isDark ? 0.6 : 0.5})` }
        ctx2.fillStyle = cols[n.type]; ctx2.fill()
      })
      const sy = (t * 50) % H
      const sg = ctx2.createLinearGradient(0, sy - 15, 0, sy + 15)
      sg.addColorStop(0, 'transparent'); sg.addColorStop(0.5, isDark ? 'rgba(232,104,26,0.05)' : 'rgba(232,104,26,0.03)'); sg.addColorStop(1, 'transparent')
      ctx2.fillStyle = sg; ctx2.fillRect(0, sy - 15, W, 30)
      bgRAF.current = requestAnimationFrame(draw2)
    }
    resize(); init(); ctx2 = c.getContext('2d'); draw2()
    const onResize = () => { resize(); init() }
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      if (bgRAF.current) cancelAnimationFrame(bgRAF.current)
    }
  }, [])

  function togglePw() {
    const input = passRef.current
    if (!input) return
    const show = input.type === 'password'
    input.type = show ? 'text' : 'password'
    if (pwIcoRef.current) {
      pwIcoRef.current.innerHTML = show
        ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'
        : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'
    }
  }

  function hideAlert() { if (alertBoxRef.current) alertBoxRef.current.classList.remove('show') }

  function shake(id) {
    const el = typeof id === 'string' ? document.getElementById(id) : id
    if (!el) return
    el.style.animation = 'shake .4s ease'
    el.addEventListener('animationend', () => el.style.animation = '', { once: true })
  }

  async function handleSignIn(e) {
    if (e) e.preventDefault()
    const u = username.trim(), p = password
    let ok = true
    if (!u) { userFieldRef.current?.classList.add('has-err'); if (errUserRef.current) errUserRef.current.textContent = 'Username is required'; ok = false }
    if (!p) { passFieldRef.current?.classList.add('has-err'); if (errPassRef.current) errPassRef.current.textContent = 'Password is required'; ok = false }
    if (!ok) return

    setBusy(true)
    setError('')

    try {
      const result = await login(u, p)
      if (result.ok) {
        if (sbtnRef.current) {
          sbtnRef.current.style.background = 'linear-gradient(135deg,#3fb950,#2f9e44)'
          sbtnRef.current.innerHTML = '<i class="ti ti-check" style="font-size:18px"></i><span>Signed in successfully!</span>'
        }
        if (alertBoxRef.current) {
          alertBoxRef.current.style.cssText = 'display:flex;color:#3fb950;background:rgba(63,185,80,.1);border-color:rgba(63,185,80,.3)'
          alertBoxRef.current.querySelector('span').textContent = 'Welcome back! Redirecting\u2026'
        }
        closeLock()
        setTimeout(() => navigate('/', { replace: true }), 1000)
      } else {
        setError(result.error || 'Invalid username or password')
        if (alertBoxRef.current) {
          alertBoxRef.current.style.cssText = 'display:flex;color:#f85149;background:rgba(248,81,73,.1);border-color:rgba(248,81,73,.28)'
          alertBoxRef.current.querySelector('span').textContent = result.error || 'Invalid username or password. Please try again.'
        }
        shake('wUser'); shake('wPass')
        userWrapRef.current?.classList.add('err')
        passWrapRef.current?.classList.add('err')
      }
    } catch (e) {
      setError(e.message || 'Connection error')
      if (alertBoxRef.current) {
        alertBoxRef.current.style.cssText = 'display:flex;color:#f85149;background:rgba(248,81,73,.1);border-color:rgba(248,81,73,.28)'
        alertBoxRef.current.querySelector('span').textContent = 'Connection error. Please try again.'
      }
    }
    setBusy(false)
  }

  function closeLock() {
    if (lockShackleRef.current) lockShackleRef.current.classList.add('locked')
    if (lockRingRef.current) {
      lockRingRef.current.style.borderColor = 'rgba(232,104,26,.6)'
      lockRingRef.current.classList.add('pulse')
    }
    setTimeout(() => {
      if (lockLabelRef.current) {
        lockLabelRef.current.textContent = 'Vault secured \u2014 access granted'
        lockLabelRef.current.classList.add('granted')
      }
    }, 650)
  }

  const handleContact = () => {
    if (alertBoxRef.current) {
      alertBoxRef.current.style.cssText = 'display:flex;color:#a371f7;background:rgba(163,113,247,.1);border-color:rgba(163,113,247,.28)'
      alertBoxRef.current.querySelector('span').textContent = 'Contact your system administrator at admin@company.com'
    }
  }

  return (
    <div className="lw" id="loginWrap" ref={loginWrapRef}>
      <canvas id="bgc" ref={bgCanvasRef} aria-hidden="true" style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 0 }} />

      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        :root{--o1:#e8681a;--o2:#f07831;--o3:#f59453;--d0:#0b0f16;--d1:#131920;--d2:#1c2330;--d3:#252e3d;--tx0:#f0f6fc;--tx1:#cdd9e5;--tx2:#768999;--brd:#2a3545;--cy:#3ec6ff;--mg:#ff5fa8;--pu:#a371f7}
        html,body{height:100%;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
        body{background:var(--d0);color:var(--tx1)}
        .lw{position:relative;overflow:hidden;min-height:100vh}
        .app2{display:flex;min-height:100vh;position:relative}
        .left{flex:0 0 56%;display:flex;flex-direction:column;padding:40px 48px 32px;position:relative;z-index:2;min-width:0}
        .brand{display:flex;align-items:center;gap:10px;flex-shrink:0}
        .brand-logo{width:38px;height:38px;object-fit:contain;animation:logoPulse 2.4s ease-in-out infinite}
        @keyframes logoPulse{0%,100%{filter:drop-shadow(0 0 6px rgba(232,104,26,.7)) drop-shadow(0 0 12px rgba(232,104,26,.35))}50%{filter:drop-shadow(0 0 16px rgba(232,104,26,1)) drop-shadow(0 0 32px rgba(232,104,26,.65)) drop-shadow(0 0 48px rgba(240,120,49,.35))}}
        .brand-name{font-size:19px;font-weight:700;color:var(--tx0);letter-spacing:-.2px}
        .brand-name b{color:var(--o1);font-weight:800}
        .left-body{flex:1;display:flex;align-items:center;gap:20px;min-height:0;padding:16px 0}
        .text-col{flex:0 0 auto;max-width:310px;min-width:0}
        .hero-title{font-size:clamp(20px,2.5vw,29px);font-weight:800;color:var(--tx0);line-height:1.22;letter-spacing:-.4px;margin-bottom:10px}
        .hero-accent{color:var(--o1)}
        .hero-sub{font-size:13px;color:var(--tx2);line-height:1.7;margin-bottom:20px}
        .chips{display:flex;flex-direction:column;gap:9px}
        .chip{display:flex;align-items:center;gap:10px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:9px 13px;width:fit-content;max-width:100%;animation:slideIn .4s ease both;opacity:0}
        .chip:nth-child(1){animation-delay:.05s}
        .chip:nth-child(2){animation-delay:.15s}
        .chip:nth-child(3){animation-delay:.25s}
        @keyframes slideIn{from{opacity:0;transform:translateX(-16px)}to{opacity:1;transform:none}}
        .chip-ico{width:30px;height:30px;border-radius:8px;background:linear-gradient(135deg,var(--o1),var(--o2));display:flex;align-items:center;justify-content:center;font-size:14px;color:#fff;flex-shrink:0}
        .chip-t{font-size:12px;font-weight:600;color:var(--tx1)}
        .chip-s{font-size:10.5px;color:var(--tx2)}
        .globe-col{flex:1;display:flex;align-items:center;justify-content:center;min-width:0;position:relative}
        .globe-wrap{position:relative;width:min(300px,28vw);height:min(300px,28vw)}
        .globe-orbit-ring{position:absolute;inset:-22px;border-radius:50%;border:1px dashed rgba(232,104,26,.22);animation:spinOrb 22s linear infinite;pointer-events:none}
        @keyframes spinOrb{to{transform:rotate(360deg)}}
        .globe-orbit-ring::after{content:'';position:absolute;top:-3.5px;left:50%;width:7px;height:7px;margin-left:-3.5px;border-radius:50%;background:var(--o1);box-shadow:0 0 8px 3px rgba(232,104,26,.7)}
        .globe-orbit-ring2{position:absolute;inset:-44px;border-radius:50%;border:1px dashed rgba(163,113,247,.15);animation:spinOrb2 32s linear infinite;pointer-events:none}
        @keyframes spinOrb2{to{transform:rotate(-360deg)}}
        .globe-orbit-ring2::after{content:'';position:absolute;bottom:8px;left:9%;width:5px;height:5px;border-radius:50%;background:var(--pu);box-shadow:0 0 7px 2px rgba(163,113,247,.6)}
        #globeCanvas{border-radius:50%;display:block;width:100%;height:100%;filter:drop-shadow(0 0 24px rgba(62,198,255,.22)) drop-shadow(0 0 48px rgba(255,95,168,.1))}
        .right{flex:1;display:flex;align-items:center;justify-content:center;padding:24px 20px;position:relative;z-index:2;min-width:0}
        .card{background:var(--d1);border:1px solid var(--brd);border-radius:20px;padding:34px 34px 26px;width:100%;max-width:396px;box-shadow:0 24px 64px rgba(0,0,0,.5)}
        .card-hdr{margin-bottom:24px}
        .card-title{font-size:22px;font-weight:800;color:var(--tx0);letter-spacing:-.3px;margin-bottom:4px}
        .card-sub{font-size:13px;color:var(--tx2)}
        .alert{display:none;align-items:center;gap:8px;border-radius:8px;padding:10px 13px;font-size:13px;margin-bottom:16px;border:1px solid}
        .alert.show{display:flex}
        .field{margin-bottom:16px}
        .flabel{font-size:11px;font-weight:700;color:var(--tx2);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px}
        .fwrap{display:flex;align-items:center;background:var(--d2);border:1.5px solid var(--brd);border-radius:10px;transition:border-color .18s,box-shadow .18s;overflow:hidden}
        .fwrap:focus-within{border-color:var(--o1);box-shadow:0 0 0 3px rgba(232,104,26,.16)}
        .fwrap.err{border-color:#f85149;box-shadow:0 0 0 3px rgba(248,81,73,.13)}
        .ficon{padding:0 11px 0 13px;font-size:16px;color:var(--tx2);flex-shrink:0}
        .finput{flex:1;background:transparent;border:none;outline:none;font-family:inherit;font-size:14px;color:var(--tx0);padding:12px 0;min-width:0}
        .finput::placeholder{color:var(--tx2)}
        .pwtoggle{padding:0 13px;font-size:17px;color:var(--tx2);background:none;border:none;cursor:pointer;transition:color .18s,transform .15s;display:flex;align-items:center;flex-shrink:0;user-select:none}
        .pwtoggle:hover{color:var(--o1);transform:scale(1.15)}
        .pwtoggle:active{transform:scale(0.95)}
        .ferr{font-size:11px;color:#f85149;margin-top:4px;display:none}
        .field.has-err .ferr{display:block}
        .field.has-err .fwrap{border-color:#f85149}
        .meta{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;flex-wrap:wrap;gap:6px}
        .remember{display:flex;align-items:center;gap:7px;cursor:pointer;user-select:none}
        .cbx{width:16px;height:16px;border-radius:4px;border:1.5px solid var(--brd);background:transparent;appearance:none;cursor:pointer;transition:all .14s;flex-shrink:0;position:relative}
        .cbx:checked{background:var(--o1);border-color:var(--o1)}
        .cbx:checked::after{content:'\\2713';position:absolute;font-size:10px;font-weight:800;color:#fff;top:-1px;left:2px}
        .rem-lbl{font-size:13px;color:var(--tx1)}
        .sbtn{width:100%;padding:13px;background:linear-gradient(135deg,var(--o1),var(--o2));border:none;border-radius:10px;font-family:inherit;font-size:15px;font-weight:700;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:9px;transition:all .2s;margin-bottom:20px;position:relative;overflow:hidden}
        .sbtn::after{content:'';position:absolute;top:0;left:-100%;width:100%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.14),transparent);transition:left .45s}
        .sbtn:hover::after{left:100%}
        .sbtn:hover{transform:translateY(-1px);box-shadow:0 8px 24px rgba(232,104,26,.4)}
        .sbtn.loading .btn-txt{opacity:0}
        .sbtn.loading .spin{display:flex!important}
        .spin{display:none;width:18px;height:18px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:sp .7s linear infinite;position:absolute}
        .btn-arrow{font-size:17px;transition:transform .18s}
        .sbtn:hover .btn-arrow{transform:translateX(4px)}
        @keyframes sp{to{transform:rotate(360deg)}}
        @keyframes shake{0%,100%{transform:none}20%{transform:translateX(-5px)}40%{transform:translateX(5px)}60%{transform:translateX(-3px)}80%{transform:translateX(3px)}}
        .lock-section{display:flex;flex-direction:column;align-items:center;gap:9px;padding:16px 8px 8px;border-top:1px solid var(--brd);margin-bottom:8px}
        .lock-tag{font-size:10.5px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:var(--tx2);margin-bottom:-2px}
        .lock-stage{position:relative;width:68px;height:74px;display:flex;align-items:center;justify-content:center}
        .lock-ring{position:absolute;inset:-10px;border-radius:50%;border:1.5px solid rgba(232,104,26,0);transition:border-color .4s;pointer-events:none}
        .lock-ring.pulse{animation:lockPulse .9s ease}
        @keyframes lockPulse{0%{box-shadow:0 0 0 0 rgba(232,104,26,.5)}100%{box-shadow:0 0 0 18px rgba(232,104,26,0)}}
        #lockShackle{transform-box:fill-box;transform-origin:0% 100%;transform:rotate(-26deg) translate(2px,-3px);transition:transform .85s cubic-bezier(.34,1.56,.64,1)}
        #lockShackle.locked{transform:rotate(0deg) translate(0,0)}
        .lock-label{font-size:12px;color:var(--tx2);text-align:center;transition:color .3s}
        .lock-label.granted{color:var(--o1);font-weight:700}
        .cfoot{text-align:center;font-size:13px;color:var(--tx2);padding-top:4px}
        .cfoot a{color:var(--o1);font-weight:700;cursor:pointer}
        .secbadge{display:flex;align-items:center;justify-content:center;gap:5px;margin-top:10px}
        .secbadge-dot{width:6px;height:6px;border-radius:50%;background:#3fb950;animation:pdot 2s infinite}
        @keyframes pdot{0%,100%{opacity:1}50%{opacity:.35}}
        .secbadge-txt{font-size:11px;color:var(--tx2)}
        @media(max-width:980px){.left{flex:0 0 50%;padding:30px 32px 26px}.globe-wrap{width:min(230px,26vw);height:min(230px,26vw)}}
        @media(max-width:760px){.left-body{flex-direction:column;align-items:flex-start;gap:14px}.text-col{max-width:100%}.globe-col{width:100%;padding:6px 0}.globe-wrap{width:180px;height:180px}.globe-orbit-ring,.globe-orbit-ring2{display:none}}
        @media(max-width:680px){.app2{flex-direction:column;min-height:auto}.left{flex:0 0 auto;padding:28px 24px 18px;order:2}.left-body{flex-direction:row;align-items:center}.text-col{flex:1}.globe-col{display:none}.right{order:1;padding:24px 16px 0}.card{border-radius:16px;padding:26px 22px 20px}.theme-row{top:12px;right:14px}.chips{display:none}}
        @media(max-width:400px){.card{padding:22px 16px 16px}.card-title{font-size:19px}}
        .globe-loading{position:absolute;inset:0;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(5,8,14,.9);color:var(--tx2);font-size:12px}
      `}</style>

      <div className="app2">
        <div className="left">
          <div className="brand">
            <img className="brand-logo" alt="UniShield 360 logo" src="/unishield-logo.png" />
            <span className="brand-name">UniShield <b>360</b></span>
          </div>

          <div className="left-body">
            <div className="text-col">
              <div className="hero-title">Unified Threat<br />Intelligence.<br /><span className="hero-accent">Stronger Security.</span></div>
              <div className="hero-sub">Real-time visibility, actionable intelligence, and faster response to every threat.</div>
              <div className="chips">
                <div className="chip"><div className="chip-ico"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" /></svg></div><div><div className="chip-t">Zero-trust architecture</div></div></div>
                <div className="chip"><div className="chip-ico"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="2" /><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" /></svg></div><div><div className="chip-t">Real-time threat detection</div></div></div>
                <div className="chip"><div className="chip-ico"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /><line x1="12" y1="15" x2="12" y2="17" /></svg></div><div><div className="chip-t">End-to-end encryption</div></div></div>
              </div>
            </div>

            <div className="globe-col">
              <div className="globe-wrap" ref={globeWrapRef}>
                <div className="globe-orbit-ring2" aria-hidden="true" />
                <div className="globe-orbit-ring" aria-hidden="true" />
                <canvas id="globeCanvas" ref={globeCanvasRef} role="img" aria-label="Rotating world map threat intelligence globe" />
                {topoLoading && (
                  <div className="globe-loading" id="globeLoading">
                    <i className="ti ti-loader" style={{ animation: 'sp .8s linear infinite', fontSize: 18 }} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="right">
          <div className="card">
            <div className="card-hdr">
              <div className="card-title">Welcome back</div>
              <div className="card-sub">Sign in to continue to UniShield 360</div>
            </div>
            <div className="alert" id="alertBox" ref={alertBoxRef} role="alert" style={{ color: '#f85149', background: 'rgba(248,81,73,.1)', borderColor: 'rgba(248,81,73,.28)' }}>
              <i className="ti ti-alert-circle" /><span id="alertTxt">{error || 'Invalid username or password.'}</span>
            </div>
            <form onSubmit={handleSignIn}>
              <div className="field" id="fUser" ref={userFieldRef}>
                <label className="flabel" htmlFor="iUser">Username</label>
                <div className="fwrap" id="wUser" ref={userWrapRef}>
                  <span className="ficon"><i className="ti ti-user" /></span>
                  <input className="finput" id="iUser" ref={userRef} type="text" placeholder="Enter your username" autoComplete="username" value={username} onChange={e => { setUsername(e.target.value); userFieldRef.current?.classList.remove('has-err'); userWrapRef.current?.classList.remove('err'); hideAlert() }} />
                </div>
                <div className="ferr" id="eUser" ref={errUserRef}>Username is required</div>
              </div>
              <div className="field" id="fPass" ref={passFieldRef}>
                <label className="flabel" htmlFor="iPass">Password</label>
                <div className="fwrap" id="wPass" ref={passWrapRef}>
                  <span className="ficon"><i className="ti ti-lock-password" /></span>
                  <input className="finput" id="iPass" ref={passRef} type="password" placeholder="Enter your password" autoComplete="current-password" value={password} onChange={e => { setPassword(e.target.value); passFieldRef.current?.classList.remove('has-err'); passWrapRef.current?.classList.remove('err'); hideAlert() }} />
                  <button type="button" className="pwtoggle" onClick={togglePw} aria-label="Show password" id="pwBtn">
                    <svg id="pwIco" ref={pwIcoRef} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                </div>
                <div className="ferr" id="ePass" ref={errPassRef}>Password is required</div>
              </div>
              <div className="meta">
                <label className="remember"><input type="checkbox" className="cbx" id="remMe" defaultChecked /><span className="rem-lbl">Remember me</span></label>
              </div>
              <button type="submit" className={`sbtn ${busy ? 'loading' : ''}`} id="sbtn" ref={sbtnRef} disabled={busy}>
                <div className="spin" id="spin" />
                <span className="btn-txt">Sign in</span>
                <span className="btn-arrow btn-txt"><i className="ti ti-arrow-right" /></span>
              </button>
            </form>
            <div className="lock-section">
              <div className="lock-tag">Vault status</div>
              <div className="lock-stage">
                <div className="lock-ring" ref={lockRingRef} />
                <svg viewBox="0 0 120 130" width="58" height="63" role="img" aria-label="Padlock authentication status indicator">
                  <defs>
                    <linearGradient id="lg2" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#f07831" />
                      <stop offset="100%" stopColor="#e8681a" />
                    </linearGradient>
                  </defs>
                  <path id="lockShackle" ref={lockShackleRef} d="M40 75 L40 56 Q40 35 60 35 Q80 35 80 56 L80 75" fill="none" stroke="url(#lg2)" strokeWidth="11" strokeLinecap="round" />
                  <rect x="32" y="72" width="56" height="46" rx="9" fill="url(#lg2)" />
                  <rect x="32" y="72" width="56" height="18" rx="9" fill="white" opacity=".12" />
                  <circle cx="60" cy="92" r="7" fill="#0b0f16" opacity=".7" />
                  <rect x="57" y="92" width="6" height="13" rx="3" fill="#0b0f16" opacity=".7" />
                </svg>
              </div>
              <div className="lock-label" ref={lockLabelRef}>Awaiting secure authentication</div>
            </div>
            <div className="cfoot">
              Don't have an account? <a onClick={handleContact} tabIndex={0} role="button" style={{ cursor: 'pointer' }}>Contact administrator</a>
              <div className="secbadge"><span className="secbadge-dot"></span><span className="secbadge-txt">Secure connection</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
