import React, { useState, useEffect } from 'react'
import { api, apiPost, apiPut, apiDelete } from '../api'
import { useAuth } from '../context/AuthContext'

export default function NotificationSettings({ onClose }) {
  const { user } = useAuth()
  const [notifs, setNotifs] = useState([])
  const [logs, setLogs] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ name: '', type: 'webhook', url: '', secret: '', enabled: true })
  const [testResult, setTestResult] = useState('')

  useEffect(() => {
    if (user?.role !== 'admin') return
    api('notifications').then(setNotifs).catch(e => console.warn('Failed to load notifications:', e))
    api('notifications/logs').then(setLogs).catch(e => console.warn('Failed to load notification logs:', e))
  }, [user])

  if (user?.role !== 'admin') return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1d27] rounded-xl shadow-2xl border border-[#e5e7eb] dark:border-[#2d3140] p-5 max-w-lg w-full mx-4 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-soc-text dark:text-soc-darktext">Notifications</h3>
          <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140] text-soc-stext/50 hover:text-soc-text dark:hover:text-soc-darktext transition-colors">&times;</button>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <button onClick={() => { setShowForm(true); setEditId(null); setForm({ name: '', type: 'webhook', url: '', secret: '', enabled: true }) }}
            className="px-2.5 py-1 text-[10px] font-medium rounded-md bg-[#EF843C] text-white hover:bg-[#d4661e] dark:bg-[#EF843C] dark:text-[#1a1d27] transition-all">+ Add Webhook</button>
        </div>

        <div className="overflow-y-auto space-y-2 flex-1">
          {notifs.length === 0 && <div className="text-[10px] text-soc-stext/40 dark:text-soc-darkstext/40 italic text-center py-4">No notifications configured</div>}

          {showForm && (
            <div className="bg-[#f8f9fa] dark:bg-[#252832] rounded-lg p-3 space-y-2 text-[10px]">
              <input placeholder="Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                className="w-full px-2 py-1.5 bg-white dark:bg-[#1a1d27] rounded outline-none text-soc-text dark:text-soc-darktext" />
              <input placeholder="Webhook URL (https://...)" value={form.url} onChange={e => setForm({...form, url: e.target.value})}
                className="w-full px-2 py-1.5 bg-white dark:bg-[#1a1d27] rounded outline-none text-soc-text dark:text-soc-darktext" />
              <input placeholder="Secret (optional)" value={form.secret} onChange={e => setForm({...form, secret: e.target.value})}
                className="w-full px-2 py-1.5 bg-white dark:bg-[#1a1d27] rounded outline-none text-soc-text dark:text-soc-darktext" />
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={form.enabled} onChange={e => setForm({...form, enabled: e.target.checked})} className="w-3 h-3" />
                  <span>Enabled</span>
                </label>
                <button onClick={save} className="ml-auto px-2.5 py-1 rounded-md bg-[#EF843C] text-white hover:bg-[#d4661e] dark:bg-[#EF843C] dark:text-[#1a1d27] text-[10px] font-medium">Save</button>
                <button onClick={() => setShowForm(false)} className="px-2 py-1 text-soc-stext/50 hover:text-soc-text transition-colors">Cancel</button>
              </div>
            </div>
          )}

          {notifs.map(n => (
            <div key={n.id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-[#f8f9fa] dark:bg-[#252832] text-[10px]">
              <div className={`w-1.5 h-1.5 rounded-full ${n.enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-soc-text dark:text-soc-darktext truncate">{n.name || n.url}</div>
                <div className="text-soc-stext/50 dark:text-soc-darkstext/50 truncate">{n.url}</div>
              </div>
              <button onClick={() => testHook(n)} className="px-1.5 py-0.5 rounded text-[9px] hover:bg-white dark:hover:bg-[#1a1d27] transition-colors" title="Test">Test</button>
              <button onClick={() => { setEditId(n.id); setForm(n); setShowForm(true) }} className="px-1.5 py-0.5 rounded text-[9px] hover:bg-white dark:hover:bg-[#1a1d27] transition-colors">Edit</button>
              <button onClick={() => remove(n.id)} className="px-1.5 py-0.5 rounded text-[9px] text-red-500 hover:bg-white dark:hover:bg-[#1a1d27] transition-colors">Del</button>
            </div>
          ))}

          {testResult && <div className="text-[10px] text-soc-stext/60 dark:text-soc-darkstext/60 bg-[#f3f4f6] dark:bg-[#2d3140] px-2 py-1 rounded">{testResult}</div>}

          {logs.length > 0 && (
            <div className="mt-3">
              <div className="text-[9px] font-semibold uppercase tracking-wider text-soc-stext/40 dark:text-soc-darkstext/40 mb-1">Delivery Log</div>
              {logs.slice(0, 20).map(l => (
                <div key={l.id} className="flex items-center gap-2 text-[9px] py-1 text-soc-stext/60 dark:text-soc-darkstext/60">
                  <span className={`w-1 h-1 rounded-full ${l.status === 'sent' ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="w-12 truncate">{l.event}</span>
                  <span className={l.status === 'sent' ? 'text-green-500' : 'text-red-500'}>{l.status}</span>
                  <span className="ml-auto">{new Date(l.createdAt).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
