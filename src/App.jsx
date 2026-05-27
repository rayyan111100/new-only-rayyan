import React, { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AppProvider, useApp } from './context/AppContext'
import Navbar from './components/Navbar'
import Sidebar from './components/Sidebar'
import QueryBar from './components/QueryBar'
import DiscoverTab from './tabs/DiscoverTab'
import DashboardTab from './tabs/DashboardTab'
import SearchTab from './tabs/SearchTab'
import AnalyticsTab from './tabs/AnalyticsTab'
import IndicesTab from './tabs/IndicesTab'
import GeoTab from './tabs/GeoTab'
import HealthTab from './tabs/HealthTab'
import RulesTab from './tabs/RulesTab'
import RuleViewTab from './tabs/RuleViewTab'
import DecoderTab from './tabs/DecoderTab'

const TABS = {
  discover: DiscoverTab,
  dashboard: DashboardTab,
  search: SearchTab,
  analytics: AnalyticsTab,
  indices: IndicesTab,
  geo: GeoTab,
  health: HealthTab,
  rules: RulesTab,
  ruleview: RuleViewTab,
  decoder: DecoderTab
}

function DashboardShell() {
  const { tab, setTab, doSearch } = useApp()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const TabComponent = TABS[tab] || DiscoverTab
  const showQueryBar = tab === 'discover' || tab === 'search' || tab === 'ruleview'

  useEffect(() => {
    if (tab === 'discover') doSearch()
  }, [])

  return (
    <div className="h-screen flex flex-col bg-soc-bg dark:bg-soc-darkbg overflow-hidden">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <div className="hidden md:flex">
          <Sidebar active={tab} onSelect={setTab} collapsed={!sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
        </div>
        <div className="md:hidden">
          <Sidebar active={tab} onSelect={setTab} collapsed={false} onToggle={() => {}} />
        </div>
        <main className="flex-1 flex flex-col overflow-hidden min-w-0">
          {showQueryBar && (
            <div className="px-2 sm:px-3 pt-2 pb-1 shrink-0">
              <QueryBar />
            </div>
          )}
          <div className="flex-1 overflow-y-auto px-2 sm:px-3 pb-4">
            <AnimatePresence mode="wait">
              <TabComponent key={tab} />
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <DashboardShell />
    </AppProvider>
  )
}
