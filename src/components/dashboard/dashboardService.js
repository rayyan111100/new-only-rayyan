const STORAGE_KEY = 'unishield_dashboards'

function generateId() {
  return 'dash_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
}

function getAll() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch { return [] }
}

function saveAll(dashboards) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(dashboards))
}

export const dashboardService = {
  create(name) {
    const now = new Date().toISOString()
    const dash = {
      id: generateId(),
      name: name || 'Untitled Dashboard',
      description: '',
      panels: [],
      timeRange: { from: 'now-24h', to: 'now' },
      globalFilters: [],
      createdAt: now,
      updatedAt: now,
      favorite: false,
      tags: [],
      version: 1,
    }
    const all = getAll()
    all.push(dash)
    saveAll(all)
    return dash
  },

  save(dashboard) {
    const all = getAll()
    const idx = all.findIndex(d => d.id === dashboard.id)
    const updated = { ...dashboard, updatedAt: new Date().toISOString(), version: (dashboard.version || 1) + 1 }
    if (idx >= 0) {
      all[idx] = updated
    } else {
      all.push(updated)
    }
    saveAll(all)
    return updated
  },

  load(id) {
    return getAll().find(d => d.id === id) || null
  },

  delete(id) {
    saveAll(getAll().filter(d => d.id !== id))
  },

  list() {
    return getAll().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
  },

  search(query) {
    if (!query) return getAll()
    const q = query.toLowerCase()
    return getAll().filter(d =>
      d.name.toLowerCase().includes(q) ||
      d.description?.toLowerCase().includes(q) ||
      d.tags?.some(t => t.toLowerCase().includes(q))
    ).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
  },

  favorite(id) {
    const all = getAll()
    const d = all.find(x => x.id === id)
    if (d) {
      d.favorite = !d.favorite
      saveAll(all)
    }
    return d
  },

  clone(id) {
    const original = getAll().find(d => d.id === id)
    if (!original) return null
    const clone = {
      ...JSON.parse(JSON.stringify(original)),
      id: generateId(),
      name: original.name + ' (Copy)',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      favorite: false,
      version: 1,
    }
    const all = getAll()
    all.push(clone)
    saveAll(all)
    return clone
  },

  export(id) {
    const d = getAll().find(x => x.id === id)
    if (!d) return null
    return JSON.stringify(d, null, 2)
  },

  import(jsonStr) {
    try {
      const data = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr
      const dash = {
        ...data,
        id: generateId(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      }
      const all = getAll()
      all.push(dash)
      saveAll(all)
      return dash
    } catch (e) {
      throw new Error('Invalid dashboard JSON: ' + e.message)
    }
  },

  addPanel(dashboardId, panel) {
    const all = getAll()
    const d = all.find(x => x.id === dashboardId)
    if (!d) return null
    d.panels = [...(d.panels || []), panel]
    d.updatedAt = new Date().toISOString()
    saveAll(all)
    return d
  },

  updatePanel(dashboardId, panelId, updates) {
    const all = getAll()
    const d = all.find(x => x.id === dashboardId)
    if (!d) return null
    d.panels = (d.panels || []).map(p => p.id === panelId ? { ...p, ...updates } : p)
    d.updatedAt = new Date().toISOString()
    saveAll(all)
    return d
  },

  removePanel(dashboardId, panelId) {
    const all = getAll()
    const d = all.find(x => x.id === dashboardId)
    if (!d) return null
    d.panels = (d.panels || []).filter(p => p.id !== panelId)
    d.updatedAt = new Date().toISOString()
    saveAll(all)
    return d
  },
}
