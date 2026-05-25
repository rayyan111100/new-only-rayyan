import React, { useEffect } from 'react'
import { motion } from 'framer-motion'
import { useApp } from '../context/AppContext'
import ResultsTable from '../components/ResultsTable'
import FieldSidebar from '../components/FieldSidebar'
import Histogram from '../components/Histogram'

export default function DiscoverTab() {
  const { total, results, loading, dql, filters, isDark } = useApp()
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.12 }} className="space-y-2">
      <div className="flex items-center gap-3 px-1 py-1 text-xs">
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] uppercase font-semibold ${isDark ? 'text-soc-darkstext' : 'text-soc-stext'}`}>Query</span>
          <span className="text-soc-blue dark:text-blue-400 font-mono">{dql || filters.length ? 'Filtered' : '*'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] uppercase font-semibold ${isDark ? 'text-soc-darkstext' : 'text-soc-stext'}`}>Total</span>
          <span className="font-bold text-soc-text dark:text-soc-darktext">{total.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] uppercase font-semibold ${isDark ? 'text-soc-darkstext' : 'text-soc-stext'}`}>Showing</span>
          <span className="text-soc-text dark:text-soc-darktext">{results.length}</span>
        </div>
        {loading && <span className="text-soc-stext dark:text-soc-darkstext">{'\u23F3'} searching...</span>}
      </div>
      <Histogram />
      <div className="flex gap-3 flex-col lg:flex-row">
        <div className="flex-1 min-w-0">
          <ResultsTable />
        </div>
        <div className="w-full lg:w-60 shrink-0">
          <FieldSidebar />
        </div>
      </div>
    </motion.div>
  )
}
