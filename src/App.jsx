import React, { useState, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AppProvider, useApp } from './context/AppContext'
import { ToastProvider } from './context/ToastContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import Navbar from './components/Navbar'
import Sidebar from './components/Sidebar'
import QueryBar from './components/QueryBar'
import ResizablePanel from './components/ResizablePanel'
import FieldSidebar from './components/FieldSidebar'
import DiscoverTab from './tabs/DiscoverTab'
import DashboardTab from './tabs/DashboardTab'
import SecurityHub from './tabs/SecurityHub'
import SearchTab from './tabs/SearchTab'
import AnalyticsTab from './tabs/AnalyticsTab'
import IndicesTab from './tabs/IndicesTab'
import GeoTab from './tabs/GeoTab'
import HealthTab from './tabs/HealthTab'
import RulesTab from './tabs/RulesTab'
import CreateRuleTab from './tabs/CreateRuleTab'
import { migrateRules } from './services/rulePersistence'
import { seedDemoData } from './services/seedData'
import RuleGroupsTab from './tabs/RuleGroupsTab'
import GroupRulesTab from './tabs/GroupRulesTab'
import RuleViewTab from './tabs/RuleViewTab'
import DecoderTab from './tabs/DecoderTab'
import RuleGuideTab from './tabs/RuleGuideTab'
import WindowsEventTab from './tabs/WindowsEventTab'
import ComplianceTab from './tabs/ComplianceTab'
import VulnerabilityTab from './tabs/VulnerabilityTab'
import PcidssTab from './tabs/PcidssTab'
import HipaaTab from './tabs/HipaaTab'
import LoginModal from './components/LoginModal'
import ErrorBoundary from './components/ErrorBoundary'

const TABS = {
  discover: DiscoverTab,
  dashboard: DashboardTab,
  securityhub: SecurityHub,
  search: SearchTab,
  analytics: AnalyticsTab,
  indices: IndicesTab,
  geo: GeoTab,
  health: HealthTab,
  vulnerability: VulnerabilityTab,
  rules: RulesTab,
  createrule: CreateRuleTab,
  rulegroups: RuleGroupsTab,
  grouprules: GroupRulesTab,
  ruleview: RuleViewTab,
  decoder: DecoderTab,
  ruleguide: RuleGuideTab,
  windowsevent: WindowsEventTab,
  compliance: ComplianceTab,
  pcidss: PcidssTab,
  hipaa: HipaaTab
}

function DashboardShell() {
  const { tab, setTab, doSearch, sidebarOpen, setSidebarOpen } = useApp()
  const { showLogin } = useAuth()
  const [rightPanelOpen, setRightPanelOpen] = useState(true)
  const firstTab = useRef(true)
  const TabComponent = TABS[tab] || DiscoverTab

  useEffect(() => {
    if (firstTab.current) { firstTab.current = false; return }
    setSidebarOpen(false)
  }, [tab])

  const showQueryBar = tab === 'discover' || tab === 'search' || tab === 'ruleview'
  const showFields = tab === 'discover' || tab === 'search' || tab === 'ruleview' || tab === 'analytics'

  useEffect(() => {
    const migrated = migrateRules()
    if (migrated > 0) console.log(`Migrated ${migrated} rules: added groupIds`)
    const seeded = seedDemoData()
    if (seeded > 0) console.log(`Seeded ${seeded} demo rules + groups`)
  }, [])

  useEffect(() => {
    if (tab === 'discover') doSearch()
  }, [])

  return (
    <div className="h-screen flex flex-col bg-soc-bg dark:bg-soc-darkbg overflow-hidden">
      <Navbar />
      <LoginModal />
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
          <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 overflow-y-auto px-2 sm:px-3 pb-4">
              <AnimatePresence mode="wait">
                <TabComponent key={tab} />
              </AnimatePresence>
            </div>
            {showFields && (
              <ResizablePanel
                defaultWidth={260}
                minWidth={180}
                maxWidth={500}
                side="right"
                storageKey="unishield_right_panel"
                visible={rightPanelOpen}
              >
                <div className="h-full flex flex-col">
                  <div className="flex items-center justify-between px-3 h-10 border-b border-[#e8eaed] dark:border-[#2a3042] shrink-0">
                    <span className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider">Fields</span>
                    <button onClick={() => setRightPanelOpen(false)}
                      className="p-1 rounded hover:bg-[#f1f3f4] dark:hover:bg-[#2a3042] text-[#5f6368] dark:text-[#9aa0b0] transition-colors">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <FieldSidebar />
                  </div>
                </div>
              </ResizablePanel>
            )}
          </div>
        </main>
        {!rightPanelOpen && showFields && (
          <button onClick={() => setRightPanelOpen(true)}
            className="fixed right-0 top-1/2 -translate-y-1/2 z-20 p-1.5 bg-white dark:bg-[#1e2337] border border-[#e8eaed] dark:border-[#2a3042] rounded-l-lg shadow-sm hover:bg-[#f1f3f4] dark:hover:bg-[#2a3042] text-[#5f6368] dark:text-[#9aa0b0] transition-colors"
            title="Show Fields">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        )}
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <ToastProvider>
          <ErrorBoundary title="Dashboard Error" message="The main dashboard encountered an error. Try refreshing.">
            <DashboardShell />
          </ErrorBoundary>
        </ToastProvider>
      </AppProvider>
    </AuthProvider>
  )
}
