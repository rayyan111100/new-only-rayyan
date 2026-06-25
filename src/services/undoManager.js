const UNDO_WINDOW_MS = 5000
let history = []
let listeners = []

function notify() {
  for (const fn of listeners) fn([...history])
}

export function addOperation(op) {
  const entry = {
    id: 'undo_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    type: op.type,
    description: op.description,
    undo: op.undo,
    timestamp: Date.now()
  }
  history.push(entry)
  prune()
  notify()
  setTimeout(() => { prune(); notify() }, UNDO_WINDOW_MS)
  return entry.id
}

export function undoOperation(id) {
  const idx = history.findIndex(h => h.id === id)
  if (idx === -1) return false
  const entry = history[idx]
  try { entry.undo() } catch (e) { console.error('Undo failed', e); return false }
  history.splice(idx, 1)
  notify()
  return true
}

export function getUndoableOperations() {
  prune()
  return [...history]
}

export function canUndo() {
  prune()
  return history.length > 0
}

function prune() {
  const cutoff = Date.now() - UNDO_WINDOW_MS
  history = history.filter(h => h.timestamp > cutoff)
}

export function subscribe(fn) {
  listeners.push(fn)
  return () => { listeners = listeners.filter(l => l !== fn) }
}

export function clearHistory() {
  history = []
  notify()
}
