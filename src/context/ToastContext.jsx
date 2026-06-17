import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { addOperation, undoOperation, subscribe, getUndoableOperations } from '../services/undoManager'

const ToastContext = createContext()

export function useToast() { return useContext(ToastContext) }

let toastId = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const [undoOps, setUndoOps] = useState([])
  const timersRef = useRef({})

  useEffect(() => {
    const unsub = subscribe(() => setUndoOps(getUndoableOperations()))
    return unsub
  }, [])

  const removeToast = useCallback(id => {
    setToasts(prev => prev.filter(t => t.id !== id))
    if (timersRef.current[id]) { clearTimeout(timersRef.current[id]); delete timersRef.current[id] }
  }, [])

  const addToast = useCallback((message, opts = {}) => {
    const id = ++toastId
    const toast = {
      id,
      message,
      type: opts.type || 'info',
      duration: opts.duration ?? 5000,
      undoable: opts.undoable || false,
      undoDescription: opts.undoDescription || '',
      action: opts.action || null
    }
    setToasts(prev => {
      const next = [...prev, toast]
      return next.length > 5 ? next.slice(-5) : next
    })
    if (toast.duration > 0) {
      timersRef.current[id] = setTimeout(() => removeToast(id), toast.duration)
    }
    return id
  }, [removeToast])

  const success = useCallback((msg, opts) => addToast(msg, { ...opts, type: 'success' }), [addToast])
  const error = useCallback((msg, opts) => addToast(msg, { ...opts, type: 'error', duration: opts?.duration ?? 8000 }), [addToast])
  const info = useCallback((msg, opts) => addToast(msg, { ...opts, type: 'info' }), [addToast])
  const warning = useCallback((msg, opts) => addToast(msg, { ...opts, type: 'warning', duration: opts?.duration ?? 6000 }), [addToast])

  const notifyOperation = useCallback((message, opType, undoFn) => {
    const id = addOperation({ type: opType, description: message, undo: undoFn })
    addToast(message, {
      type: 'success',
      undoable: true,
      undoDescription: message,
      action: undoFn ? {
        label: 'Undo',
        onClick: () => { undoOperation(id); removeToast(id) }
      } : null
    })
  }, [addToast, removeToast])

  const value = { addToast, removeToast, success, error, info, warning, notifyOperation, toasts, undoOps, undoOperation: (id) => { undoOperation(id) } }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} onUndo={id => { undoOperation(id); removeToast(id) }} />
    </ToastContext.Provider>
  )
}

function ToastContainer({ toasts, onDismiss, onUndo }) {
  return (
    <div className="fixed bottom-6 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none" style={{ maxWidth: '380px' }}>
      <AnimatePresence mode="popLayout">
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} onUndo={() => onUndo(t.id)} />
        ))}
      </AnimatePresence>
    </div>
  )
}

function ToastItem({ toast, onDismiss, onUndo }) {
  const styleMap = {
    success: { border: '#22c55e', bg: '#f0fdf4', darkBg: '#052e16', text: '#16a34a', darkText: '#86efac', icon: 'M20 6L9 17l-5-5' },
    error: { border: '#ef4444', bg: '#fef2f2', darkBg: '#450a0a', text: '#dc2626', darkText: '#fca5a5', icon: 'M18 6L6 18M6 6l12 12' },
    info: { border: '#EF843C', bg: '#eff6ff', darkBg: '#0c1929', text: '#e0752a', darkText: '#93c5fd', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    warning: { border: '#f59e0b', bg: '#fffbeb', darkBg: '#1c1400', text: '#d97706', darkText: '#fde047', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z' }
  }
  const s = styleMap[toast.type] || styleMap.info

  return (
    <motion.div
      layout initial={{ opacity: 0, x: 80, scale: 0.95 }} animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, scale: 0.95 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className="pointer-events-auto rounded-xl shadow-2xl border overflow-hidden"
      style={{ backgroundColor: s.bg, borderColor: s.border }}
    >
      <div className="dark:hidden flex items-start gap-2.5 px-3 py-2.5">
        <svg className="w-4 h-4 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke={s.text} strokeWidth="2"><path d={s.icon} /></svg>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-soc-stext leading-relaxed">{toast.message}</p>
          {(toast.undoable || toast.action) && (
            <div className="flex items-center gap-2 mt-1.5">
              {toast.undoable && <button onClick={onUndo} className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-white/80 hover:bg-white shadow-sm transition-colors" style={{ color: s.text }}>Undo</button>}
              {toast.action && <button onClick={toast.action.onClick} className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-white/80 hover:bg-white shadow-sm transition-colors" style={{ color: s.text }}>{toast.action.label}</button>}
            </div>
          )}
        </div>
        <button onClick={onDismiss} className="p-0.5 rounded hover:bg-black/5 transition-colors shrink-0" style={{ color: s.text }}>
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div className="hidden dark:flex items-start gap-2.5 px-3 py-2.5" style={{ backgroundColor: s.darkBg }}>
        <svg className="w-4 h-4 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke={s.darkText} strokeWidth="2"><path d={s.icon} /></svg>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-soc-darkstext leading-relaxed">{toast.message}</p>
          {(toast.undoable || toast.action) && (
            <div className="flex items-center gap-2 mt-1.5">
              {toast.undoable && <button onClick={onUndo} className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-black/30 hover:bg-black/50 shadow-sm transition-colors" style={{ color: s.darkText }}>Undo</button>}
              {toast.action && <button onClick={toast.action.onClick} className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-black/30 hover:bg-black/50 shadow-sm transition-colors" style={{ color: s.darkText }}>{toast.action.label}</button>}
            </div>
          )}
        </div>
        <button onClick={onDismiss} className="p-0.5 rounded hover:bg-white/5 transition-colors shrink-0" style={{ color: s.darkText }}>
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
    </motion.div>
  )
}
