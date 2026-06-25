import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import RuleBuilder from '../components/RuleBuilder'
import TestLab from '../components/TestLab'
import { getAllGroups } from '../services/ruleStorage'

const SUB_TABS = [
  { key: 'editor', label: 'Editor', icon: 'M16.376 3.622a1 1 0 013.002 3.002L7.368 18.635a2 2 0 01-.855.506l-2.872.838a.5.5 0 01-.62-.62l.838-2.872a2 2 0 01.506-.854z' },
  { key: 'testlab', label: 'Test Lab', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
]

export default function RulesTab() {
  const [subTab, setSubTab] = useState('editor')
  const [filterGroupIds, setFilterGroupIds] = useState([])
  const groups = getAllGroups()

  function toggleGroupFilter(id) {
    setFilterGroupIds(prev =>
      prev.includes(id) ? prev.filter(gid => gid !== id) : [...prev, id]
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.12 }}
      className="h-full flex flex-col"
    >
      <div className="flex items-center gap-1 px-3 sm:px-4 py-1.5 border-b border-[#e5e7eb] dark:border-[#2d3140] bg-white dark:bg-[#16181f] shrink-0">
        {SUB_TABS.map(t => (
          <button key={t.key} onClick={() => setSubTab(t.key)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
              subTab === t.key
                ? 'bg-[#EF843C]/10 text-[#EF843C] shadow-sm'
                : 'text-[#6b7280] dark:text-[#9ca3af] hover:bg-[#f3f4f6] dark:hover:bg-[#2d3140]'
            }`}>
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d={t.icon}/></svg>
            {t.label}
          </button>
        ))}
      </div>

      {subTab === 'editor' && groups.length > 0 && (
        <div className="flex items-center gap-1.5 px-3 sm:px-4 py-2 border-b border-[#e5e7eb] dark:border-[#2d3140] bg-white dark:bg-[#16181f] shrink-0 overflow-x-auto">
          <span className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider mr-1 shrink-0">Groups:</span>
          {groups.map(g => {
            const active = filterGroupIds.includes(g.id)
            return (
              <button key={g.id} onClick={() => toggleGroupFilter(g.id)}
                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium transition-all whitespace-nowrap ${
                  active
                    ? 'bg-[#324059] text-white shadow-sm'
                    : 'bg-[#f3f4f6] dark:bg-[#2d3140] text-[#6b7280] dark:text-[#9ca3af] hover:bg-[#e5e7eb] dark:hover:bg-[#374151]'
                }`}>
                {g.name}
              </button>
            )
          })}
          {filterGroupIds.length > 0 && (
            <button onClick={() => setFilterGroupIds([])}
              className="text-[10px] text-[#9ca3af] hover:text-[#6b7280] dark:hover:text-[#e4e6eb] ml-1 shrink-0">
              Clear
            </button>
          )}
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {subTab === 'editor' ? (
            <motion.div key="editor" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
              <RuleBuilder filterGroupIds={filterGroupIds} onGroupFilterChange={setFilterGroupIds} />
            </motion.div>
          ) : (
            <motion.div key="testlab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
              <TestLab />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
