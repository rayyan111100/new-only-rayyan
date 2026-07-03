import React, { useState, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AppProvider, useApp } from './context/AppContext'
import { ToastProvider } from './context/ToastContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import Navbar from './components/Navbar'
import Sidebar from './components/Sidebar'
import SearchTab from './tabs/SearchTab'
import AnalyticsTab from './tabs/AnalyticsTab'
import IndicesTab from './tabs/IndicesTab'
import GeoTab from './tabs/GeoTab'
import WindowsEventTab from './tabs/WindowsEventTab'
import ComplianceTab from './tabs/ComplianceTab'
import PcidssTab from './tabs/PcidssTab'
import HipaaTab from './tabs/HipaaTab'
import GdprTab from './tabs/GdprTab'
import TscTab from './tabs/TscTab'
import MitreAttackTab from './tabs/MitreAttackTab'
import NistTab from './tabs/NistTab'
import LoginModal from './components/LoginModal'
import ErrorBoundary from './components/ErrorBoundary'

const TABS = {
  search: SearchTab,
  analytics: AnalyticsTab,
  indices: IndicesTab,
  geo: GeoTab,
  windowsevent: WindowsEventTab,
  compliance: ComplianceTab,
  pcidss: PcidssTab,
  hipaa: HipaaTab,
  gdpr: GdprTab,
  tscsoc2: TscTab,
  mitreattack: MitreAttackTab,
  nist80053: NistTab
}

function DashboardShell() {
  const { tab, setTab, sidebarOpen, setSidebarOpen } = useApp()
  const { showLogin } = useAuth()
  const [rightPanelOpen, setRightPanelOpen] = useState(true)
  const firstTab = useRef(true)
  const TabComponent = TABS[tab] || SearchTab
  useEffect(() => {
    if (firstTab.current) { firstTab.current = false; return }
    setSidebarOpen(false)
  }, [tab])

  const showFields = tab === 'search' || tab === 'analytics'

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
          <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 overflow-y-auto px-2 sm:px-3 pb-4">
              <AnimatePresence mode="wait">
                <TabComponent key={tab} />
              </AnimatePresence>
            </div>
          </div>
        </main>
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
