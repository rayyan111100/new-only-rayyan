import React from 'react'
import { motion } from 'framer-motion'
import RuleBuilder from '../components/RuleBuilder'

export default function RulesTab() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.12 }}
      className="h-full flex flex-col"
    >
      <RuleBuilder />
    </motion.div>
  )
}
