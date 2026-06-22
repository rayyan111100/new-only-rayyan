const STORAGE_KEY = 'unishield_folders'
const VERSION_KEY = 'unishield_folders_v'
const CURRENT_VERSION = 2

function makeId() {
  return (Math.random().toString(36).slice(2, 8) + Date.now().toString(36))
}

function getAll() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') }
  catch { return null }
}

function saveAll(folders) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(folders))
}

export const folderService = {
  init() {
    const ver = parseInt(localStorage.getItem(VERSION_KEY) || '0')
    if (ver < CURRENT_VERSION) {
      localStorage.removeItem(STORAGE_KEY)
      localStorage.setItem(VERSION_KEY, String(CURRENT_VERSION))
    }
    return getAll() || []
  },

  list() {
    return getAll() || []
  },

  getFolder(id) {
    return (getAll() || []).find(f => f.id === id) || null
  },

  createFolder(name) {
    const folders = getAll() || []
    const folder = {
      id: 'folder_' + makeId(),
      name,
      system: false,
      tabs: [{
        id: 'tab_' + makeId(),
        name: 'Overview',
        panels: [],
        timeRange: { from: 'now-24h', to: 'now' },
        globalFilters: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        favorite: false,
      }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    folders.push(folder)
    saveAll(folders)
    return folder
  },

  updateFolder(id, data) {
    const folders = getAll() || []
    const idx = folders.findIndex(f => f.id === id)
    if (idx < 0) return null
    folders[idx] = { ...folders[idx], ...data, updatedAt: new Date().toISOString() }
    saveAll(folders)
    return folders[idx]
  },

  deleteFolder(id) {
    const folders = getAll() || []
    const f = folders.find(f => f.id === id)
    if (f && f.system) return false
    saveAll(folders.filter(f => f.id !== id))
    return true
  },

  createTab(folderId, name) {
    const folders = getAll() || []
    const f = folders.find(f => f.id === folderId)
    if (!f) return null
    const tab = {
      id: 'tab_' + makeId(),
      name: name || 'New Tab',
      panels: [],
      timeRange: { from: 'now-24h', to: 'now' },
      globalFilters: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      favorite: false,
    }
    f.tabs.push(tab)
    f.updatedAt = new Date().toISOString()
    saveAll(folders)
    return tab
  },

  updateTab(folderId, tabId, data) {
    const folders = getAll() || []
    const f = folders.find(f => f.id === folderId)
    if (!f) return null
    const t = f.tabs.find(t => t.id === tabId)
    if (!t) return null
    Object.assign(t, data, { updatedAt: new Date().toISOString() })
    f.updatedAt = new Date().toISOString()
    saveAll(folders)
    return t
  },

  deleteTab(folderId, tabId) {
    const folders = getAll() || []
    const f = folders.find(f => f.id === folderId)
    if (!f) return false
    if (f.tabs.length <= 1) return false
    f.tabs = f.tabs.filter(t => t.id !== tabId)
    f.updatedAt = new Date().toISOString()
    saveAll(folders)
    return true
  },

  saveDashboardToTab(folderId, tabId, dashboard) {
    return folderService.updateTab(folderId, tabId, {
      name: dashboard.name || dashboard.title,
      panels: dashboard.panels || [],
      timeRange: dashboard.timeRange || { from: 'now-24h', to: 'now' },
      globalFilters: dashboard.globalFilters || [],
    })
  },

  getTabAsDashboard(folderId, tabId) {
    const f = folderService.getFolder(folderId)
    if (!f) return null
    const t = f.tabs.find(t => t.id === tabId)
    if (!t) return null
    return { ...t, name: t.name }
  },
}