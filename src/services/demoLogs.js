const DEMO_LOGS = {
  // Firewall & Network
  // Windows Security
  // Linux Security
  // File Integrity
  // Authentication
  // Web Security
  // General
  critical_alert: [
    { rule: { level: 14, description: 'Critical security event detected', groups: ['attack'] }, agent: { name: 'wazuh-manager' } }
  ],
  malware_detected: [
    { rule: { level: 15, description: 'Malware: Trojan detected', groups: ['malware', 'virus'] }, agent: { name: 'win-10' } }
  ],
  pci_alert: [
    { rule: { level: 10, description: 'PCI DSS: Cardholder data accessed', groups: ['pci', 'compliance'] }, agent: { name: 'db-server' } }
  ]
}

export function getDemoLog(templateId) {
  return DEMO_LOGS[templateId] || null
}

export function getDemoLogKeys() {
  return Object.keys(DEMO_LOGS)
}

export function getAllDemoLogs() {
  return DEMO_LOGS
}

export default DEMO_LOGS
