import React from 'react'
import { motion } from 'framer-motion'
import DashboardStats from '../components/DashboardStats'

export default function DashboardTab() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }} className="space-y-4">
      <div className="text-xs text-soc-stext dark:text-soc-darkstext">Security Overview</div>
      <DashboardStats />
    </motion.div>
  )
}
