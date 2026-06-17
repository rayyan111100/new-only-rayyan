import React from 'react'
import { motion } from 'framer-motion'
import RuleBuilder from '../components/RuleBuilder'
import ResizableSplitter from '../components/ResizableSplitter'

export default function CreateRuleTab() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.12 }}
      className="h-full flex flex-col"
    >
      <div className="flex-1 min-h-0">
        <RuleBuilder />
      </div>
    </motion.div>
  )
}