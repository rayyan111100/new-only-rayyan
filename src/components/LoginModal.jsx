import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function LoginModal() {
  const { showLogin, setShowLogin, login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!showLogin) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!username.trim() || !password) return
    setBusy(true); setError('')
    try {
      const result = await login(username, password)
      if (!result.ok) setError(result.error || 'Login failed')
    } catch { setError('Connection error') }
    setBusy(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowLogin(false)}>
      <div className="bg-white dark:bg-[#1a1d27] rounded-xl shadow-2xl border border-[#e5e7eb] dark:border-[#2d3140] p-6 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-5 h-5 text-soc-blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <h2 className="text-base font-semibold text-soc-text dark:text-soc-darktext">Sign In</h2>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-[10px] font-medium text-soc-stext/60 dark:text-soc-darkstext/60 uppercase tracking-wide">Username</label>
            <input autoFocus value={username} onChange={e => setUsername(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#f3f4f6] dark:bg-[#2d3140] rounded-lg outline-none text-soc-text dark:text-soc-darktext border border-transparent focus:border-[#EF843C]/30 dark:focus:border-[#EF843C]/30 transition-colors mt-1" />
          </div>
          <div>
            <label className="text-[10px] font-medium text-soc-stext/60 dark:text-soc-darkstext/60 uppercase tracking-wide">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#f3f4f6] dark:bg-[#2d3140] rounded-lg outline-none text-soc-text dark:text-soc-darktext border border-transparent focus:border-[#EF843C]/30 dark:focus:border-[#EF843C]/30 transition-colors mt-1" />
          </div>
          {error && <div className="text-[10px] text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-1.5 rounded">{error}</div>}
          <button type="submit" disabled={busy}
            className="w-full py-2 text-xs font-medium rounded-lg bg-[#EF843C] text-white hover:bg-[#d4661e] dark:bg-[#EF843C] dark:text-[#1a1d27] dark:hover:bg-[#EF843C] transition-all shadow-sm disabled:opacity-50">
            {busy ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <div className="mt-3 text-center text-[9px] text-soc-stext/40 dark:text-soc-darkstext/40">Default: admin / admin</div>
      </div>
    </div>
  )
}
