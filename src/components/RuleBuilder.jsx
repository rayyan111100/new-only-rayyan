import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getAllRules, createRule, updateRule, deleteRule, toggleRuleEnabled, getAllGroups } from '../services/ruleStorage'
import { saveRuleWithVersion } from '../services/ruleVersionStorage'
import { addRulesToGroup } from '../services/ruleGroupManager'
import GroupBulkActions from './GroupBulkActions'
import VersionHistoryPanel from './VersionHistoryPanel'
import ConditionGroupEditor from './ConditionGroupEditor'
import { evalRule, interpolateMessage } from '../services/ruleEngine'
import { resolveField } from '../utils'
import { GDPR_FIELDS, getGdprField } from '../data/gdprFields'
import { api } from '../api'
import { useApp } from '../context/AppContext'
import { useToast } from '../context/ToastContext'

function extractFieldPaths(obj, prefix = '') {
  const paths = []
  for (const key of Object.keys(obj)) {
    const p = prefix ? `${prefix}.${key}` : key
    paths.push(p)
    if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
      paths.push(...extractFieldPaths(obj[key], p))
    }
  }
  return paths
}

const COMMON_FIELDS = [
  'rule.description', 'rule.id', 'rule.level', 'rule.category', 'rule.groups', 'rule.firedtimes',
  'agent.name', 'agent.id', 'agent.ip',
  'decoder.name', 'full_log', 'location', 'input.type',
  'predecoder.program_name', 'predecoder.hostname', 'manager.name',
  'data.srcip', 'data.dstip', 'data.srcport', 'data.dstport', 'data.protocol', 'data.url',
  'data.action', 'data.user', 'data.system_name', 'data.host',
  'decoded.format', 'decoded.src_ip', 'decoded.dst_ip', 'decoded.src_port', 'decoded.dst_port',
  'decoded.protocol', 'decoded.action', 'decoded.direction', 'decoded.interface',
  'decoded.timestamp', 'decoded.hostname', 'decoded.appName', 'decoded.pid',
  'decoded.user', 'decoded.method', 'decoded.status_code', 'decoded.url', 'decoded.referrer',
  'decoded.user_agent', 'decoded.message', 'decoded.logon_type', 'decoded.account',
  'decoded.srcip', 'decoded.dstip', 'decoded.srcport', 'decoded.dstport',
  '@timestamp', 'timestamp', 'id', '_id', '_index'
]

const OPERATORS = ['equals', 'contains', 'regex', 'startsWith', 'endsWith', 'gt', 'gte', 'lt', 'lte', 'inList', 'exists']
const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info']

const SEV_COLORS = { critical: { dot: '#dc2626', bg: '#fef2f2', darkBg: '#dc26261a', text: '#dc2626', darkText: '#fca5a5' }, high: { dot: '#ea580c', bg: '#fff7ed', darkBg: '#ea580c1a', text: '#ea580c', darkText: '#fdba74' }, medium: { dot: '#ca8a04', bg: '#fefce8', darkBg: '#ca8a041a', text: '#ca8a04', darkText: '#fde047' }, low: { dot: '#16a34a', bg: '#f0fdf4', darkBg: '#16a34a1a', text: '#16a34a', darkText: '#86efac' }, info: { dot: '#2563eb', bg: '#eff6ff', darkBg: '#3b82f61a', text: '#2563eb', darkText: '#93c5fd' } }

function cleanItem(item) {
  if (item.type === 'group') {
    return {
      ...item,
      logic: item.logic || 'AND',
      conditions: (item.conditions || item.items || []).map(cleanItem)
    }
  }
  return {
    ...item,
    field: item.field || 'rule.description',
    operator: item.operator || 'contains',
    value: item.value || '',
    logic: item.logic || 'AND'
  }
}

function cleanRule(r) {
  return {
    ...r, name: r.name || '',
    overwrite: r.overwrite !== false,
    conditionLogic: r.conditionLogic === 'OR' ? 'OR' : 'AND',
    conditions: (r.conditions || []).map(cleanItem),
    actions: (r.actions?.length ? r.actions : [{ type: 'alert', params: { severity: 'high', message: '' } }]).map(a => ({ ...a, params: a.params || {} })),
    enabled: r.enabled !== false,
    tags: r.tags || []
  }
}

function Toggle({ checked, onChange }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={onChange}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/30 ${checked ? 'bg-[#3b82f6]' : 'bg-[#d1d5db] dark:bg-[#4b5563]'}`}>
      <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform ring-0 transition-all duration-200 ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
    </button>
  )
}

function SeverityDot({ sev }) {
  const c = SEV_COLORS[sev] || SEV_COLORS.high
  return <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.dot }} />
}

function conditionsToQuery(conditions, logic) {
  const parts = conditions.map(c => {
    if (c.type === 'group') {
      const sub = conditionsToQuery(c.conditions || c.items || [], c.logic || 'AND')
      return sub ? `(${sub})` : null
    }
    const neg = c.negate ? 'NOT ' : ''
    const v = c.value?.replace(/[\\"'(){}[\]^~:]/g, '\\$&')
    if (!v && c.operator !== 'exists') return null
    switch (c.operator) {
      case 'equals': return `${neg}${c.field}:${v}`
      case 'contains': return `${neg}${c.field}:*${v}*`
      case 'startsWith': return `${neg}${c.field}:${v}*`
      case 'endsWith': return `${neg}${c.field}:*${v}`
      case 'gt': return `${neg}${c.field}:[${v} TO *]`
      case 'gte': return `${neg}${c.field}:[${v} TO *]`
      case 'lt': return `${neg}${c.field}:[* TO ${v}]`
      case 'lte': return `${neg}${c.field}:[* TO ${v}]`
      case 'exists': return `${neg}_exists_:${c.field}`
      case 'regex':
      case 'inList':
        return null
      default: return null
    }
  }).filter(Boolean)
  if (!parts.length) return ''
  return parts.join(` ${logic === 'OR' ? 'OR' : 'AND'} `)
}

function Kbd({ children }) {
  return <kbd className="hidden lg:inline px-1 py-0.5 text-[9px] font-mono rounded bg-[#f3f4f6] dark:bg-[#2d3140] text-[#9ca3af] border border-[#e5e7eb] dark:border-[#2d3140]">{children}</kbd>
}

const GDPR_FIELD_NAMES = GDPR_FIELDS.map(f => f.field)

let dynamicFields = null
function getFields() {
  const base = dynamicFields || (() => {
    const stored = sessionStorage.getItem('ruleFields')
    if (stored) { dynamicFields = JSON.parse(stored); return dynamicFields }
    return COMMON_FIELDS
  })()
  return [...new Set([...base, ...GDPR_FIELD_NAMES])].sort((a, b) => a.localeCompare(b))
}

function storeFields(list) {
  const merged = [...new Set([...COMMON_FIELDS, ...GDPR_FIELD_NAMES, ...list])].sort((a, b) => a.localeCompare(b))
  dynamicFields = merged
  try { sessionStorage.setItem('ruleFields', JSON.stringify(merged)) } catch {}
}

export default function RuleBuilder({ filterGroupIds = [], onGroupFilterChange }) {
  const [rules, setRules] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [editing, setEditing] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [testResults, setTestResults] = useState(null)
  const [testLoading, setTestLoading] = useState(false)
  const [testJson, setTestJson] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [fields, setFieldsState] = useState(getFields)
  const [extractedFields, setExtractedFields] = useState(null)
  const [selectedRuleIds, setSelectedRuleIds] = useState([])
  const [sortBy, setSortBy] = useState('name')
  const [sortOrder, setSortOrder] = useState('asc')
  const [addToGroupRuleId, setAddToGroupRuleId] = useState(null)
  const [saveComment, setSaveComment] = useState('')
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const { pendingRuleId, setPendingRuleId } = useApp()
  const toast = useToast()

  const refresh = useCallback(() => {
    setRules(getAllRules())
    setSelectedRuleIds([])
  }, [])

  useEffect(() => { refresh() }, [refresh])

  useEffect(() => {
    if (!fields.includes('data.win.system.eventID')) {
      api('search', { limit: 5, sort: '@timestamp', order: 'desc' }).then(d => {
        if (!d?.results?.length) return
        const paths = new Set()
        for (const doc of d.results) {
          extractFieldPaths(doc).forEach(p => { if (!p.startsWith('_') && p !== 'id') paths.add(p) })
        }
        storeFields([...paths])
        setFieldsState(getFields())
      }).catch(() => {})
    }
  }, [])

  useEffect(() => {
    function handleKey(e) {
      if (e.key === 's' && (e.metaKey || e.ctrlKey) && editing && !showSaveModal) { e.preventDefault(); handleSave() }
    }
    document.addEventListener('keydown', handleKey); return () => document.removeEventListener('keydown', handleKey)
  }, [editing, dirty])

  useEffect(() => {
    if (pendingRuleId) {
      const r = getAllRules().find(x => x.id === pendingRuleId)
      if (r) handleSelect(pendingRuleId)
      setPendingRuleId(null)
    }
  }, [pendingRuleId])

  function handleSave() {
    if (!editing?.id) return
    if (showSaveModal) return
    setShowSaveModal(true)
  }

  function doSave(comment) {
    if (!editing?.id) return
    saveRuleWithVersion(editing, comment)
    setDirty(false)
    setShowSaveModal(false)
    setSaveComment('')
    refresh()
    toast.success('Rule saved with version history')
  }

  function cancelSave() {
    setShowSaveModal(false)
    setSaveComment('')
    if (pendingSelectId) {
      const pid = pendingSelectId
      setPendingSelectId(null)
      doNavigateToRule(pid)
    }
  }

  const [pendingSelectId, setPendingSelectId] = useState(null)

  function doNavigateToRule(id) {
    setSelectedId(id)
    const r = getAllRules().find(x => x.id === id)
    setEditing(r ? cleanRule(JSON.parse(JSON.stringify(r))) : null)
    setDirty(false)
    setShowHistory(false)
    if (window.innerWidth < 1024) setSidebarOpen(false)
  }

  function handleSelect(id) {
    if (dirty && editing) {
      if (showSaveModal) {
        setPendingSelectId(id)
        return
      }
      setPendingSelectId(id)
      setShowSaveModal(true)
      return
    }
    doNavigateToRule(id)
  }

  function handleNew() {
    const r = createRule({ name: 'New Rule' })
    refresh(); setSelectedId(r.id); setEditing(cleanRule(JSON.parse(JSON.stringify(r)))); setDirty(false)
    if (window.innerWidth < 1024) setSidebarOpen(false)
  }

  function handleDelete() {
    if (!editing?.id) return
    deleteRule(editing.id); setSelectedId(null); setEditing(null); setDirty(false); refresh()
  }

  function toggleRuleSelection(id) {
    setSelectedRuleIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function toggleSelectAll() {
    if (visibleRules.every(r => selectedRuleIds.includes(r.id))) {
      setSelectedRuleIds([])
    } else {
      setSelectedRuleIds(visibleRules.map(r => r.id))
    }
  }

  function quickAddToGroup(ruleId, groupId) {
    addRulesToGroup(groupId, [ruleId])
    refresh()
    const g = allGroups.find(x => x.id === groupId)
    toast.success(`Added rule to group "${g?.name || groupId}"`)
    setAddToGroupRuleId(null)
  }

  function patch(p) { setEditing(prev => prev ? { ...prev, ...p } : null); setDirty(true) }

  function updAction(idx, p) {
    setEditing(prev => { if (!prev) return prev; const a = [...prev.actions]; a[idx] = { ...a[idx], ...p }; return { ...prev, actions: a } })
    setDirty(true)
  }

  function delAction(idx) {
    if (!editing || editing.actions.length <= 1) return
    setEditing({ ...editing, actions: editing.actions.filter((_, i) => i !== idx) })
    setDirty(true)
  }

  function computeSeverity(act, doc) {
    const lvl = parseInt(resolveField(doc, 'rule.level'))
    if (isNaN(lvl)) return act.params?.severity || 'high'
    if (lvl >= 12) return 'critical'
    if (lvl >= 8) return 'high'
    if (lvl >= 5) return 'medium'
    if (lvl >= 3) return 'low'
    return 'info'
  }

  function setNested(obj, path, val) {
    const parts = path.split('.')
    let cur = obj
    for (let i = 0; i < parts.length - 1; i++) {
      if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {}
      cur = cur[parts[i]]
    }
    cur[parts[parts.length - 1]] = val
  }

  function flattenConditions(items) {
    let result = []
    for (const item of items) {
      if (item.type === 'group') {
        result = result.concat(flattenConditions(item.conditions || item.items || []))
      } else {
        result.push(item)
      }
    }
    return result
  }

  function generateMockDocs(conditions) {
    const flat = flattenConditions(conditions)
    const base = {
      '@timestamp': new Date().toISOString(),
      rule: { id: 100001, description: 'Test Event', level: 5, groups: ['test'] },
      agent: { name: 'test-agent', id: '001', ip: '192.168.1.10' },
      location: '/var/log/test.log',
      manager: { name: 'wazuh-manager' },
      decoder: { name: 'json' },
      full_log: 'Test log entry for rule validation'
    }
    const matchDoc = JSON.parse(JSON.stringify(base))
    for (const c of flat) {
      if (c.operator === 'exists') { setNested(matchDoc, c.field, 'present') }
      else if (c.operator === 'inList') { setNested(matchDoc, c.field, c.value.split(',')[0].trim()) }
      else if (c.operator === 'gt' || c.operator === 'gte') {
        const v = parseFloat(c.value) + 1
        setNested(matchDoc, c.field, isNaN(v) ? c.value : v)
      } else if (c.operator === 'lt' || c.operator === 'lte') {
        const v = Math.max(0, parseFloat(c.value) - 1)
        setNested(matchDoc, c.field, isNaN(v) ? c.value : v)
      } else { setNested(matchDoc, c.field, c.value) }
    }
    const noMatchDoc = {
      '@timestamp': new Date(Date.now() - 60000).toISOString(),
      rule: { id: 999999, description: 'Unrelated Event', level: 3, groups: ['other'] },
      agent: { name: 'other-agent', id: '999', ip: '10.0.0.1' },
      location: '/var/log/other.log',
      manager: { name: 'wazuh-manager' },
      decoder: { name: 'json' },
      full_log: 'This event does not match any conditions'
    }
    return [matchDoc, noMatchDoc]
  }

  function findMissingInterpolationFields(template, doc) {
    if (!template) return []
    const matches = [...template.matchAll(/\{\{([^}]+)\}\}/g)]
    return matches.map(m => m[1].trim()).filter(f => {
      const v = resolveField(doc, f)
      return v === '' || v === `{{${f}}}`
    })
  }

  async function runTestBatch() {
    if (!editing) return
    setTestLoading(true); setTestResults(null)
    try {
      const q = conditionsToQuery(editing.conditions, editing.conditionLogic)
      let docs = []

      try {
        const d = await api('search', { limit: 20, sort: '@timestamp', order: 'desc', q })
        if (d?.results?.length) docs = d.results
      } catch {}

      if (!docs.length && q) {
        try {
          const d = await api('search', { limit: 20, sort: '@timestamp', order: 'desc' })
          if (d?.results?.length) docs = d.results
        } catch {}
      }

      if (!docs.length && testJson.trim()) {
        try {
          const parsed = JSON.parse(testJson)
          docs = Array.isArray(parsed) ? parsed : [parsed]
        } catch {}
      }

      if (!docs.length) {
        docs = generateMockDocs(editing.conditions)
      }

      if (!docs.length) { setTestResults({ error: 'No data to test against' }); setTestLoading(false); return }

      const results = docs.map(doc => {
        const result = evalRule(editing, doc)
        const actions = result.matched ? (editing.actions || []).map(a => ({
          ...a, computedSeverity: a.type === 'alert' ? computeSeverity(a, doc) : null,
          interpolated: a.type === 'alert' ? interpolateMessage(a.params?.message || '', doc) : null,
          missingFields: a.type === 'alert' ? findMissingInterpolationFields(a.params?.message, doc) : []
        })) : []
        return { timestamp: resolveField(doc, '@timestamp'), ruleDesc: resolveField(doc, 'rule.description'), ruleLevel: resolveField(doc, 'rule.level'), ...result, actions }
      })
      setTestResults(results)
    } catch (e) { setTestResults({ error: e.message }) }
    setTestLoading(false)
  }

  function extractFromJson() {
    if (!testJson.trim()) return
    try {
      const doc = JSON.parse(testJson)
      const paths = extractFieldPaths(doc).filter(p => !p.startsWith('_') && p !== 'id')
      setExtractedFields(paths)
      storeFields(paths)
      setFieldsState(getFields())
    } catch {}
  }

  function runTestJson() {
    if (!editing || !testJson.trim()) return
    setTestLoading(true); setTestResults(null)
    try {
      const doc = JSON.parse(testJson)
      const paths = extractFieldPaths(doc).filter(p => !p.startsWith('_') && p !== 'id')
      setExtractedFields(paths)
      storeFields(paths)
      setFieldsState(getFields())
      const result = evalRule(editing, doc)
      const actions = result.matched ? (editing.actions || []).map(a => ({
        ...a, computedSeverity: a.type === 'alert' ? computeSeverity(a, doc) : null,
        interpolated: a.type === 'alert' ? interpolateMessage(a.params?.message || '', doc) : null,
        missingFields: a.type === 'alert' ? findMissingInterpolationFields(a.params?.message, doc) : []
      })) : []
      setTestResults([{ timestamp: resolveField(doc, '@timestamp'), ruleDesc: resolveField(doc, 'rule.description'), ruleLevel: resolveField(doc, 'rule.level'), ...result, actions }])
    } catch (e) { setTestResults({ error: 'Invalid JSON: ' + e.message }) }
    setTestLoading(false)
  }

  const allRules = getAllRules()
  const allGroups = getAllGroups()
  const groupMap = Object.fromEntries(allGroups.map(g => [g.id, g]))
  const visibleRules = (filterGroupIds.length > 0
    ? allRules.filter(r => (r.groupIds || []).some(gid => filterGroupIds.includes(gid)))
    : allRules
  ).sort((a, b) => {
    let cmp = 0
    switch (sortBy) {
      case 'name': cmp = a.name.localeCompare(b.name); break
      case 'date': cmp = (a.updatedAt || a.createdAt || '').localeCompare(b.updatedAt || b.createdAt || ''); break
      case 'status': cmp = (a.enabled === b.enabled ? 0 : a.enabled ? -1 : 1); break
      case 'group': {
        const ag = (a.groupIds || []).length ? groupMap[a.groupIds[0]]?.name || '' : ''
        const bg = (b.groupIds || []).length ? groupMap[b.groupIds[0]]?.name || '' : ''
        cmp = ag.localeCompare(bg)
        break
      }
    }
    return sortOrder === 'desc' ? -cmp : cmp
  })
  const sidebarWidth = sidebarOpen ? 'w-56 lg:w-56' : 'w-0 lg:w-0'

  return (
    <div className="flex flex-col h-full bg-[#f8f9fc] dark:bg-[#0e0f14]">
      <header className="flex items-center gap-2 px-3 sm:px-4 py-2 text-xs border-b border-[#e5e7eb] dark:border-[#2d3140] bg-white dark:bg-[#16181f] flex-wrap">
        <button onClick={() => setSidebarOpen(o => !o)} className="p-1 -ml-1 rounded-lg hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140] transition-colors shrink-0"
          title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}>
          <svg className="w-4 h-4 text-[#6b7280]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {sidebarOpen ? <path d="M9 5l7 7-7 7"/> : <path d="M15 19l-7-7 7-7"/>}
          </svg>
        </button>
        <span className="font-semibold text-soc-stext dark:text-soc-darkstext flex items-center gap-1.5 shrink-0">
          <svg className="w-3.5 h-3.5 text-[#3b82f6]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9M16.376 3.622a1 1 0 013.002 3.002L7.368 18.635a2 2 0 01-.855.506l-2.872.838a.5.5 0 01-.62-.62l.838-2.872a2 2 0 01.506-.854z"/></svg>
          <span className="hidden sm:inline">Rules Engine</span>
        </span>
        <span className="text-[#9ca3af] dark:text-[#6b7280] ml-1 shrink-0">
          {filterGroupIds.length > 0 ? `${visibleRules.length} of ` : ''}{allRules.length} rules, {visibleRules.filter(r => r.enabled).length} enabled
          {filterGroupIds.length > 0 && <span className="ml-1 text-[#3b82f6]">(filtered)</span>}
        </span>

        {allGroups.length > 0 && (
          <div className="flex items-center gap-1 overflow-x-auto max-w-[200px] sm:max-w-none">
            {allGroups.map(g => {
              const cnt = allRules.filter(r => (r.groupIds || []).includes(g.id)).length
              const active = filterGroupIds.includes(g.id)
              return (
                <button key={g.id} onClick={() => { const upd = active ? filterGroupIds.filter(id => id !== g.id) : [...filterGroupIds, g.id]; onGroupFilterChange && onGroupFilterChange(upd) }}
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium transition-all whitespace-nowrap ${
                    active ? 'text-white shadow-sm' : 'bg-[#f3f4f6] dark:bg-[#2d3140] text-[#6b7280] dark:text-[#9ca3af] hover:bg-[#e5e7eb] dark:hover:bg-[#374151]'
                  }`}
                  style={active ? { backgroundColor: g.color } : {}}>
                  <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: active ? 'white' : g.color }} />
                  {g.name}
                  <span className="opacity-70">({cnt})</span>
                </button>
              )
            })}
          </div>
        )}

        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          <div className="relative">
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
              className="bg-[#f3f4f6] dark:bg-[#2d3140] border border-transparent rounded-lg px-2 py-1 text-[10px] outline-none text-[#6b7280] dark:text-[#9ca3af] cursor-pointer appearance-none pr-5">
              <option value="name">Name</option>
              <option value="date">Date</option>
              <option value="status">Status</option>
              <option value="group">Group</option>
            </select>
            <svg className="absolute right-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 text-[#9ca3af] pointer-events-none" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z"/></svg>
          </div>
          <button onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}
            className="p-1 rounded hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140] text-[#6b7280] transition-colors">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {sortOrder === 'asc' ? <path d="M8 7l4-4 4 4M12 3v18"/> : <path d="M8 17l4 4 4-4M12 21V3"/>}
            </svg>
          </button>
          <span className="hidden sm:flex items-center gap-1 text-[9px] text-[#9ca3af]"><Kbd>⌘S</Kbd> to save</span>
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <AnimatePresence initial={false}>
          {sidebarOpen && (
            <motion.aside key="sidebar" initial={{ width: 0, opacity: 0 }} animate={{ width: 'auto', opacity: 1 }} exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="border-r border-[#e5e7eb] dark:border-[#2d3140] overflow-hidden bg-white dark:bg-[#16181f] shrink-0">
              <div className="w-56 flex flex-col h-full">
                <div className="p-3 border-b border-[#e5e7eb] dark:border-[#2d3140]">
                  <button onClick={handleNew} className="gbtn text-xs w-full flex items-center justify-center gap-1.5 bg-[#3b82f6] text-white hover:bg-[#2563eb] active:bg-[#1d4ed8] shadow-sm transition-all">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                    New Rule
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto py-1">
                  {visibleRules.length === 0 && (
                    <div className="flex flex-col items-center gap-2 text-[#9ca3af] text-xs text-center py-10 px-4">
                      <svg className="w-8 h-8 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                      {filterGroupIds.length > 0 ? 'No rules match the selected groups' : 'No rules yet'}
                    </div>
                  )}
                  {visibleRules.map(r => {
                    const ruleGroupIds = r.groupIds || []
                    const isSelected = selectedRuleIds.includes(r.id)
                    return (
                      <div key={r.id}
                        className={`group relative border-l-2 transition-all duration-150 ${
                          selectedId === r.id
                            ? 'bg-soc-blue/5 dark:bg-blue-500/10 border-l-soc-blue dark:border-l-blue-400'
                            : 'border-l-transparent hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140]'
                        }`}>
                        <div className="flex items-start gap-1 px-2 py-1.5">
                          <div className="flex items-center gap-1.5 min-w-0 flex-1" onClick={() => handleSelect(r.id)}>
                            <span className={`w-2 h-2 rounded-full shrink-0 mt-0.5 transition-colors ${r.enabled ? 'bg-green-500 shadow-sm shadow-green-500/30' : 'bg-[#d1d5db] dark:bg-[#4b5563]'}`} />
                            <span className="truncate font-medium text-xs text-soc-stext dark:text-soc-darkstext">{r.name}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <label onClick={e => e.stopPropagation()} className="flex items-center">
                              <input type="checkbox" checked={isSelected} onChange={() => toggleRuleSelection(r.id)}
                                className="w-3.5 h-3.5 rounded border-[#d1d5db] dark:border-[#4b5563] text-[#3b82f6] focus:ring-[#3b82f6]/30 cursor-pointer" />
                            </label>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                              selectedId === r.id
                                ? 'bg-soc-blue/10 dark:bg-blue-500/20 text-soc-blue dark:text-blue-400'
                                : 'bg-[#f3f4f6] dark:bg-[#2d3140] text-[#9ca3af] dark:text-[#6b7280]'
                            }`}>{r.enabled ? 'ON' : 'OFF'}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 px-2 pb-1.5 -mt-0.5 flex-wrap">
                          {ruleGroupIds.slice(0, 2).map(gid => {
                            const g = groupMap[gid]
                            if (!g) return null
                            return (
                              <button key={gid} onClick={e => { e.stopPropagation(); handleSelect(r.id) }}
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-medium text-white truncate max-w-[80px]"
                                style={{ backgroundColor: g.color }}
                                title={g.name}>
                                {g.name}
                                <span onClick={e => { e.stopPropagation(); quickAddToGroup(r.id, gid) }}
                                  className="ml-0.5 hover:bg-white/20 rounded-full p-0.5 leading-none"
                                  style={{ display: ruleGroupIds.length > 1 ? undefined : 'none' }}>
                                  ×
                                </span>
                              </button>
                            )
                          })}
                          {ruleGroupIds.length > 2 && (
                            <span className="text-[8px] text-[#9ca3af] font-medium">+{ruleGroupIds.length - 2}</span>
                          )}
                          <div className="relative">
                            <button onClick={e => { e.stopPropagation(); setAddToGroupRuleId(addToGroupRuleId === r.id ? null : r.id) }}
                              className="p-0.5 rounded hover:bg-[#e5e7eb] dark:hover:bg-[#374151] text-[#9ca3af] opacity-0 group-hover:opacity-100 transition-all">
                              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
                            </button>
                            {addToGroupRuleId === r.id && (
                              <div className="absolute left-0 top-full mt-1 bg-white dark:bg-[#1a1d27] border border-[#e5e7eb] dark:border-[#2d3140] rounded-lg shadow-xl py-1 min-w-[140px] z-50">
                                {allGroups.filter(g => !ruleGroupIds.includes(g.id)).length === 0 && (
                                  <div className="px-3 py-2 text-[10px] text-[#9ca3af] italic">In all groups</div>
                                )}
                                {allGroups.filter(g => !ruleGroupIds.includes(g.id)).map(g => (
                                  <button key={g.id} onClick={() => quickAddToGroup(r.id, g.id)}
                                    className="w-full text-left px-3 py-1.5 text-[10px] hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140] text-soc-stext dark:text-soc-darkstext flex items-center gap-2">
                                    <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: g.color }} />
                                    {g.name}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="px-3 py-2 border-t border-[#e5e7eb] dark:border-[#2d3140] flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-[10px] text-[#9ca3af] cursor-pointer">
                    <input type="checkbox" checked={visibleRules.length > 0 && visibleRules.every(r => selectedRuleIds.includes(r.id))}
                      onChange={toggleSelectAll}
                      className="w-3.5 h-3.5 rounded border-[#d1d5db] dark:border-[#4b5563] text-[#3b82f6] focus:ring-[#3b82f6]/30 cursor-pointer" />
                    Select All
                  </label>
                  {selectedRuleIds.length > 0 && (
                    <span className="text-[9px] text-[#3b82f6] font-medium">{selectedRuleIds.length} selected</span>
                  )}
                </div>
                {editing && (
                  <div className="border-t border-[#e5e7eb] dark:border-[#2d3140]">
                    <button onClick={() => setShowHistory(o => !o)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-medium text-[#6b7280] dark:text-[#9ca3af] hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140] transition-colors">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                      Version History
                      <svg className={`w-3 h-3 ml-auto transition-transform ${showHistory ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6"/></svg>
                    </button>
                    <AnimatePresence>
                      {showHistory && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden">
                          <div className="px-3 pb-3">
                            <VersionHistoryPanel ruleId={editing.id}
                              onRollback={result => {
                                setEditing(cleanRule(JSON.parse(JSON.stringify(result))))
                                setDirty(false)
                              }}
                              onExport={newId => {
                                const r = getAllRules().find(x => x.id === newId)
                                if (r) { refresh(); setEditing(cleanRule(JSON.parse(JSON.stringify(r)))); setSelectedId(newId); setDirty(false) }
                              }} />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
        <div className="flex-1 overflow-y-auto p-3 sm:p-5">
          {!editing ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-full text-sm text-[#9ca3af] gap-3">
              <svg className="w-12 h-12 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              <span>Select a rule or create a new one</span>
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto space-y-4 sm:space-y-5 pb-28">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 bg-white dark:bg-[#16181f] rounded-xl border border-[#e5e7eb] dark:border-[#2d3140] px-4 py-3 shadow-sm">
                <div className="flex-1 w-full sm:w-auto relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9ca3af]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9M16.376 3.622a1 1 0 013.002 3.002L7.368 18.635a2 2 0 01-.855.506l-2.872.838a.5.5 0 01-.62-.62l.838-2.872a2 2 0 01.506-.854z"/></svg>
                  <input className="ginput w-full pl-8 text-sm font-semibold py-2" value={editing.name} onChange={e => patch({ name: e.target.value })} placeholder="Rule name" />
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-auto">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-medium uppercase tracking-wider ${editing.overwrite ? 'text-purple-600 dark:text-purple-400' : 'text-[#9ca3af]'}`}>Overwrite</span>
                    <Toggle checked={editing.overwrite} onChange={() => patch({ overwrite: !editing.overwrite })} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-[#9ca3af] font-medium uppercase tracking-wider">{editing.enabled ? 'Enabled' : 'Disabled'}</span>
                    <Toggle checked={editing.enabled} onChange={() => patch({ enabled: !editing.enabled })} />
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-[#16181f] rounded-xl border border-[#e5e7eb] dark:border-[#2d3140] shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-3 sm:px-4 py-3 border-b border-[#e5e7eb] dark:border-[#2d3140]">
                  <div className="flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-[#9ca3af]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    <span className="text-[11px] uppercase font-semibold text-[#9ca3af] tracking-wider">Conditions</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="hidden sm:inline text-[10px] text-[#9ca3af]">{editing.conditions.length} item{editing.conditions.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                <div className="p-3 sm:p-4">
                  <ConditionGroupEditor
                    conditions={editing.conditions}
                    logic={editing.conditionLogic}
                    fieldList={fields}
                    depth={0}
                    onChange={newConditions => { patch({ conditions: newConditions }); setDirty(true) }}
                    onLogicChange={newLogic => { patch({ conditionLogic: newLogic }); setDirty(true) }}
                  />
                </div>
              </div>

              {(() => {
                const allConditions = flattenConditions(editing.conditions || [])
                const gdprConditions = allConditions.filter(c => getGdprField(c.field))
                if (gdprConditions.length === 0) return null
                return (
                  <div className="bg-white dark:bg-[#16181f] rounded-xl border border-[#e5e7eb] dark:border-[#2d3140] shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-3 sm:px-4 py-3 border-b border-[#e5e7eb] dark:border-[#2d3140]">
                      <div className="flex items-center gap-2">
                        <svg className="w-3.5 h-3.5 text-[#9ca3af]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                        <span className="text-[11px] uppercase font-semibold text-[#9ca3af] tracking-wider">GDPR</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="hidden sm:inline text-[10px] text-[#9ca3af]">{gdprConditions.length} item{gdprConditions.length !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    <div className="p-3 sm:p-4">
                      <div className="flex flex-wrap gap-2">
                        {gdprConditions.map((c, i) => {
                          const gf = getGdprField(c.field)
                          return (
                            <div key={i} className="flex items-center gap-1.5 px-2 py-1 bg-[#f9fafb] dark:bg-[#0f1117] rounded-lg border border-[#e5e7eb] dark:border-[#2d3140] text-[10px]">
                              <span className="text-xs">{gf.icon}</span>
                              <span className="font-medium text-soc-stext dark:text-soc-darkstext">{c.field}</span>
                              <span className="text-[#9ca3af]">{c.operator}</span>
                              <span className="text-soc-stext dark:text-soc-darkstext">"{c.value}"</span>
                              <span className="text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-1 py-0.5 rounded text-[9px] font-medium ml-1 whitespace-nowrap">
                                {gf.gdprArticle}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )
              })()}

              <div className="bg-white dark:bg-[#16181f] rounded-xl border border-[#e5e7eb] dark:border-[#2d3140] shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-3 sm:px-4 py-3 border-b border-[#e5e7eb] dark:border-[#2d3140]">
                  <div className="flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-[#9ca3af]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    <span className="text-[11px] uppercase font-semibold text-[#9ca3af] tracking-wider">Actions</span>
                  </div>
                </div>
                <div className="p-3 sm:p-4 space-y-2.5">
                  {editing.actions.map((act, idx) => (
                    <div key={idx} className="flex items-start gap-3 bg-[#f9fafb] dark:bg-[#0f1117] rounded-xl border border-[#e5e7eb] dark:border-[#2d3140] p-3">
                      <div className="flex items-center gap-2 text-xs flex-1 flex-wrap min-w-0">
                        <div className="relative">
                          <select className="ginput w-20 sm:w-22 pl-6 py-1.5 font-medium appearance-none cursor-pointer text-[11px] sm:text-xs" value={act.type} onChange={e => {
                            if (e.target.value === 'alert') updAction(idx, { type: 'alert', params: { severity: 'high', message: '' } })
                            else updAction(idx, { type: 'ignore', params: {} })
                          }}>
                            <option value="alert">create</option>
                            <option value="ignore">ignore</option>
                          </select>
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none">{act.type === 'alert' && <SeverityDot sev={act.params?.severity || 'high'} />}</span>
                        </div>
                        {act.type === 'alert' ? (
                          <>
                            <select className="ginput w-22 sm:w-24 py-1.5 text-[11px] sm:text-xs" value={act.params?.severity || 'high'} onChange={e => updAction(idx, { params: { ...act.params, severity: e.target.value } })}>
                              {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <input className="ginput flex-1 py-1.5 font-mono text-[11px] min-w-[120px]" placeholder="Message ({{field}})" value={act.params?.message || ''} onChange={e => updAction(idx, { params: { ...act.params, message: e.target.value } })} />
                          </>
                        ) : (
                          <span className="flex items-center gap-1.5 text-[#9ca3af] text-[11px] italic">
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>
                            Silently ignore matching events
                          </span>
                        )}
                      </div>
                      <button onClick={() => delAction(idx)} className="p-1.5 text-[#9ca3af] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all shrink-0">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white dark:bg-[#16181f] rounded-xl border border-[#e5e7eb] dark:border-[#2d3140] shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-3 sm:px-4 py-3 border-b border-[#e5e7eb] dark:border-[#2d3140]">
                  <div className="flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-[#9ca3af]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                    <span className="text-[11px] uppercase font-semibold text-[#9ca3af] tracking-wider">Groups</span>
                  </div>
                </div>
                <div className="p-3 sm:p-4">
                  {(() => {
                    const groups = getAllGroups()
                    const ruleGroupIds = editing.groupIds || []
                    if (groups.length === 0) {
                      return <div className="text-xs text-[#9ca3af] py-2 italic">No groups defined — manage groups in the Groups tab</div>
                    }
                    return (
                      <div className="flex flex-wrap gap-1.5">
                        {groups.map(g => {
                          const active = ruleGroupIds.includes(g.id)
                          return (
                            <button key={g.id} onClick={() => {
                              const updated = active
                                ? ruleGroupIds.filter(id => id !== g.id)
                                : [...ruleGroupIds, g.id]
                              patch({ groupIds: updated })
                            }}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[10px] font-medium transition-all ${
                                active
                                  ? 'text-white shadow-sm'
                                  : 'bg-[#f3f4f6] dark:bg-[#2d3140] text-[#6b7280] dark:text-[#9ca3af] hover:bg-[#e5e7eb] dark:hover:bg-[#374151]'
                              }`}
                              style={active ? { backgroundColor: g.color } : {}}>
                              <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: active ? 'white' : g.color }} />
                              {g.name}
                            </button>
                          )
                        })}
                      </div>
                    )
                  })()}
                </div>
              </div>

              <div className="bg-white dark:bg-[#16181f] rounded-xl border border-[#e5e7eb] dark:border-[#2d3140] shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-3 sm:px-4 py-3 border-b border-[#e5e7eb] dark:border-[#2d3140]">
                  <div className="flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-[#9ca3af]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
                    <span className="text-[11px] uppercase font-semibold text-[#9ca3af] tracking-wider">Test</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={runTestBatch} disabled={testLoading}
                      className={`gbtn text-xs flex items-center gap-1 ${testLoading ? 'opacity-60 cursor-wait' : ''} bg-[#f3f4f6] dark:bg-[#2d3140] hover:bg-[#e5e7eb] dark:hover:bg-[#374151] transition-all`}>
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
                      Batch (filtered)
                    </button>
                    <button onClick={runTestJson} disabled={testLoading || !testJson.trim()}
                      className={`gbtn text-xs flex items-center gap-1 ${testLoading ? 'opacity-60 cursor-wait' : ''} bg-[#3b82f6] text-white hover:bg-[#2563eb] active:bg-[#1d4ed8] shadow-sm transition-all`}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 3l14 9-14 9V3z"/></svg>
                      Test JSON
                    </button>
                  </div>
                </div>
                <div className="p-3 sm:p-4 space-y-3">
                  <div className="flex gap-2">
                    <textarea className="ginput flex-1 p-2 text-[10px] font-mono leading-relaxed resize-none" rows={3}
                      placeholder={`Paste alert JSON here to test instantly...`}
                      value={testJson} onChange={e => { setTestJson(e.target.value); setExtractedFields(null) }} />
                    {testJson.trim() && (
                      <button onClick={extractFromJson}
                        className="gbtn shrink-0 self-start text-[10px] px-2 py-1.5 bg-[#f3f4f6] dark:bg-[#2d3140] hover:bg-[#e5e7eb] dark:hover:bg-[#374151] transition-all flex flex-col items-center gap-0.5">
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                        <span>Fields</span>
                      </button>
                    )}
                  </div>
                  {extractedFields && extractedFields.length > 0 && (
                    <div className="bg-[#f9fafb] dark:bg-[#0f1117] rounded-lg border border-[#e5e7eb] dark:border-[#2d3140] p-2">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[9px] uppercase font-semibold text-[#9ca3af] tracking-wider">{extractedFields.length} fields</span>
                        <span className="text-[8px] text-[#9ca3af]">Click to copy</span>
                      </div>
                      <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                        {extractedFields.map(f => (
                          <button key={f} onClick={() => { navigator.clipboard?.writeText(f); }}
                            className="text-[9px] px-1.5 py-0.5 rounded-full bg-white dark:bg-[#1a1d27] border border-[#e5e7eb] dark:border-[#2d3140] text-soc-stext dark:text-soc-darkstext hover:bg-[#3b82f6] hover:text-white dark:hover:bg-[#3b82f6] transition-colors font-mono">
                            {f}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {testResults && !Array.isArray(testResults) && (
                    <div className="flex items-center gap-2 text-xs text-red-500 bg-red-50 dark:bg-red-900/10 rounded-lg px-3 py-2">
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                      {testResults.error || 'Failed'}
                    </div>
                  )}
                  {testResults && Array.isArray(testResults) && (
                    <>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="font-semibold text-green-600 dark:text-green-400">{testResults.filter(r => r.matched).length}</span>
                          <span className="text-[#9ca3af]">/ {testResults.length} matched</span>
                        </div>
                        <div className="flex-1 h-1.5 bg-[#f3f4f6] dark:bg-[#2d3140] rounded-full overflow-hidden min-w-[60px]">
                          <div className="h-full bg-green-500 rounded-full transition-all duration-300" style={{ width: `${(testResults.filter(r => r.matched).length / testResults.length) * 100}%` }} />
                        </div>
                      </div>
                      <div className="max-h-52 overflow-y-auto space-y-1.5 text-xs">
                        {testResults.slice(0, 30).map((r, idx) => (
                          <div key={idx} className={`flex items-start gap-2.5 p-2 rounded-lg border transition-colors ${
                            r.matched
                              ? 'bg-green-50/80 dark:bg-green-900/8 border-green-200/60 dark:border-green-800/30'
                              : 'bg-transparent border-transparent'
                          }`}>
                            <div className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                              r.matched ? 'bg-green-500 text-white' : 'bg-[#f3f4f6] dark:bg-[#2d3140] text-[#9ca3af]'
                            }`}>
                              <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                {r.matched ? <path d="M20 6L9 17l-5-5"/> : <path d="M18 6L6 18M6 6l12 12"/>}
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="font-mono text-[10px] text-[#9ca3af]">{r.timestamp ? String(r.timestamp).slice(0, 19).replace('T', ' ') : ''}</span>
                                <span className={`badge text-[9px] ${r.ruleLevel > 10 ? 'badge-critical' : r.ruleLevel > 7 ? 'badge-high' : r.ruleLevel > 4 ? 'badge-medium' : 'badge-low'}`}>{r.ruleLevel}</span>
                              </div>
                              <div className="truncate text-soc-stext dark:text-soc-darkstext">{r.ruleDesc}</div>
                              {r.matched && r.actions.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                  {r.actions.map((a, ai) => (
                                    <span key={ai} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium ${
                                      a.type === 'alert'
                                        ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800/40'
                                        : 'bg-[#f3f4f6] dark:bg-[#2d3140] text-[#6b7280] dark:text-[#9ca3af]'
                                    }`}>
                                      {a.type === 'alert' && <SeverityDot sev={a.computedSeverity || 'high'} />}
                                      {a.type === 'alert' ? 'CREATE' : 'IGNORE'}
                                      {a.type === 'alert' && a.interpolated && <span className="opacity-70">: {a.interpolated}</span>}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {r.matched && r.actions.some(a => a.missingFields?.length > 0) && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {r.actions.filter(a => a.missingFields?.length > 0).map((a, ai) => (
                                    <div key={ai} className="flex flex-wrap items-center gap-1 text-[9px]">
                                      {a.missingFields.map((f, fi) => (
                                        <span key={fi} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-yellow-50 dark:bg-yellow-900/15 text-yellow-700 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800/30">
                                          <svg className="w-2.5 h-2.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>
                                          <span>field not found: <code className="font-mono underline decoration-dotted">{f}</code></span>
                                        </span>
                                      ))}
                                    </div>
                                  ))}
                                </div>
                              )}
                              {!r.matched && r.details?.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {r.details.map((d, di) => (
                                    <span key={di} className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                                      d.matched
                                        ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                                        : d.condition.missing
                                          ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                                          : 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                                    }`}>
                                      {d.matched
                                        ? `${d.condition.field} ${d.condition.operator} "${d.condition.value}" - ${d.reason || 'matched'}`
                                        : d.condition.missing
                                          ? `Field "${d.condition.field}" not in this alert`
                                          : `${d.condition.field} ${d.condition.operator} "${d.condition.value}" - ${d.reason || 'not matched'}`
                                      }
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className={`fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-[#16181f]/95 backdrop-blur border-t border-[#e5e7eb] dark:border-[#2d3140] px-3 sm:px-5 py-3 flex items-center gap-2 sm:gap-3 z-10 shadow-[0_-1px_3px_rgba(0,0,0,0.05)] ${selectedRuleIds.length > 0 ? 'hidden' : ''}`}
                style={{ marginLeft: sidebarOpen ? undefined : 0 }}>
                <button onClick={handleSave} className="gbtn text-xs flex items-center gap-1.5 bg-[#3b82f6] text-white hover:bg-[#2563eb] active:bg-[#1d4ed8] shadow-sm px-3 sm:px-4 transition-all"
                  title="Ctrl+S">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 13l4 4L19 7"/></svg>
                  <span className="hidden sm:inline">Save</span>
                </button>
                <button onClick={() => { toggleRuleEnabled(editing.id); patch({ enabled: !editing.enabled }) }}
                  className={`gbtn text-xs px-3 sm:px-4 transition-all ${editing.enabled ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 border border-amber-200 dark:border-amber-800/40' : 'bg-[#3b82f6] text-white hover:bg-[#2563eb]'}`}>
                  {editing.enabled ? 'Disable' : 'Enable'}
                </button>
                <button onClick={handleDelete} className="gbtn text-xs flex items-center gap-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 border border-transparent hover:border-red-200 dark:hover:border-red-800/40 px-3 sm:px-4 transition-all">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  <span className="hidden sm:inline">Delete</span>
                </button>
                <div className="flex-1" />
                {dirty && (
                  <span className="flex items-center gap-1.5 text-[10px] text-amber-600 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-900/20 px-2.5 py-1 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    Unsaved
                  </span>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </div>
      <GroupBulkActions
        selectedRuleIds={selectedRuleIds}
        visibleRuleIds={visibleRules.map(r => r.id)}
        onSelectionChange={setSelectedRuleIds}
        onRefresh={refresh}
      />

      <AnimatePresence>
        {showSaveModal && editing && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={cancelSave}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-white dark:bg-[#1a1d27] rounded-xl border border-[#e5e7eb] dark:border-[#2d3140] shadow-xl p-5 max-w-md w-full mx-3" onClick={e => e.stopPropagation()}>
              <h3 className="text-sm font-semibold text-soc-stext dark:text-soc-darkstext mb-2">Save Rule</h3>
              <p className="text-xs text-[#6b7280] dark:text-[#9ca3af] mb-3">Why did you change this?</p>
              <input className="ginput w-full text-xs py-2 px-3 mb-4" autoFocus
                placeholder="Describe your changes (optional)" value={saveComment}
                onChange={e => setSaveComment(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') doSave(saveComment); if (e.key === 'Escape') setShowSaveModal(false) }} />
              <div className="flex items-center justify-end gap-2">
                <button onClick={cancelSave}
                  className="gbtn text-xs px-3 py-1.5 bg-[#f3f4f6] dark:bg-[#2d3140] hover:bg-[#e5e7eb] dark:hover:bg-[#374151] transition-colors">Cancel</button>
                <button onClick={() => doSave(saveComment)}
                  className="gbtn text-xs px-4 py-1.5 bg-[#3b82f6] text-white hover:bg-[#2563eb] transition-colors">Save</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
