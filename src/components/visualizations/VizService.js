const STORAGE_KEY = 'unishield_visualizations'

export const vizService = {
  list() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]').sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)) }
    catch { return [] }
  },

  get(id) {
    return vizService.list().find(v => v.id === id) || null
  },

  save(viz) {
    const all = vizService.list()
    const idx = all.findIndex(v => v.id === viz.id)
    const entry = { ...viz, updatedAt: new Date().toISOString() }
    if (idx >= 0) all[idx] = entry
    else all.push(entry)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
    return entry
  },

  delete(id) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(vizService.list().filter(v => v.id !== id)))
  },

  create(config = {}) {
    const viz = {
      id: 'viz_' + Date.now(),
      name: config.name || 'New Visualization',
      description: config.description || '',
      type: config.type || 'bar',
      config: config.config || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      starred: false,
    }
    vizService.save(viz)
    return viz
  },

  duplicate(id) {
    const original = vizService.get(id)
    if (!original) return null
    return vizService.create({
      name: original.name + ' (Copy)',
      type: original.type,
      config: JSON.parse(JSON.stringify(original.config)),
    })
  },
}
