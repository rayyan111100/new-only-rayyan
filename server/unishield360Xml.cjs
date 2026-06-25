// ─── Rule-to-UniShield360-XML converter ───
// Converts dashboard JSON rules ↔ UniShield360 XML rule format

function escapeXml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

// Operator mapping: dashboard → UniShield360 XML
const OP_TO_XML = {
  equals: 'match',
  contains: 'match',
  regex: 'regex',
  startsWith: 'match',
  endsWith: 'match',
  gt: 'greater',
  gte: 'greater_or_equal',
  lt: 'less',
  lte: 'less_or_equal',
  inList: 'match',
  exists: 'field_exists'
}

// Convert a single condition to XML field rule
function conditionToXml(cond, indent = '    ') {
  const field = cond.field || ''
  const op = cond.operator || 'equals'
  const val = cond.value || ''
  const negate = cond.negate ? ' negate="yes"' : ''

  // Determine UniShield360 XML field name
  let xmlField = field
  // Map common dashboard fields to UniShield360 XML fields
  const fieldMap = {
    'rule.id': 'id', 'rule.level': 'level', 'rule.description': 'description',
    'rule.category': 'category', 'rule.groups': 'groups',
    'agent.name': 'agent_name', 'agent.id': 'agent_id',
    'decoder.name': 'decoder_name',
    'full_log': 'match',
    'location': 'location',
    'data.srcip': 'srcip', 'data.dstip': 'dstip',
    'data.srcport': 'srcport', 'data.dstport': 'dstport',
    'data.action': 'action', 'data.url': 'url',
    'data.status': 'status', 'data.user': 'user',
    'decoded.src_ip': 'srcip', 'decoded.dst_ip': 'dstip',
    'decoded.src_port': 'srcport', 'decoded.dst_port': 'dstport',
    'decoded.action': 'action', 'decoded.protocol': 'protocol',
    'decoded.user': 'user', 'decoded.status': 'status',
    'decoded.hostname': 'hostname', 'decoded.message': 'match'
  }
  xmlField = fieldMap[field] || field

  if (op === 'exists') return `${indent}<field name="${escapeXml(xmlField)}" type="any"${negate}/>`
  if (op === 'regex') return `${indent}<field name="${escapeXml(xmlField)}" type="regex"${negate}>${escapeXml(val)}</field>`
  if (['gt','gte','lt','lte'].includes(op)) {
    const xmlOp = OP_TO_XML[op] || 'match'
    return `${indent}<field name="${escapeXml(xmlField)}" type="${xmlOp}"${negate}>${escapeXml(val)}</field>`
  }
  if (op === 'inList') {
    const items = val.split(',').map(s => s.trim()).filter(Boolean)
    const groups = items.map(item => `${indent}  <list>${escapeXml(item)}</list>`).join('\n')
    return `${indent}<field name="${escapeXml(xmlField)}" type="match"${negate}>\n${groups}\n${indent}</field>`
  }
  if (op === 'contains') {
    return `${indent}<field name="${escapeXml(xmlField)}" type="match"${negate}>${escapeXml(val)}</field>`
  }
  return `${indent}<field name="${escapeXml(xmlField)}" type="match"${negate}>${escapeXml(val)}</field>`
}

function conditionsToXml(items, indent = '  ') {
  let xml = ''
  for (const item of items) {
    if (item.type === 'group') {
      const logic = item.logic === 'OR' ? 'or' : 'and'
      const children = conditionsToXml(item.conditions || [], indent + '  ')
      xml += `${indent}<${logic}>\n${children}${indent}</${logic}>\n`
    } else {
      xml += conditionToXml(item, indent) + '\n'
    }
  }
  return xml
}

// Convert dashboard rule to UniShield360 XML rule string
function ruleToUnishield360Xml(rule) {
  const level = rule.actions?.[0]?.params?.level || 1
  const severity = rule.actions?.[0]?.params?.severity || 'info'
  const message = rule.actions?.[0]?.params?.message || 'Alert triggered'
  const groups = rule.groupIds?.map(g => `<group>${escapeXml(g)}</group>`).join('\n    ') || ''
  const groupIds = (rule.groupIds || []).map(g => `group="${escapeXml(g)}"`).join(' ')

  // Build condition groups
  const conditionsXml = conditionsToXml(rule.conditions || [])

  return `<!-- Rule generated from dashboard: ${escapeXml(rule.name)} -->
<rule id="${escapeXml(String(rule.id).replace(/[^a-zA-Z0-9_-]/g, '_'))}" level="${level}" ${groupIds} overwrite="${rule.overwrite !== false ? 'yes' : 'no'}">
  <if_sid>000</if_sid>
  <status>${rule.enabled ? 'enabled' : 'disabled'}</status>
  <description>${escapeXml(message)}</description>
  ${groups ? `  ${groups}\n` : ''}${conditionsXml}
  <options>no_full_log</options>
</rule>`
}

// Convert dashboard rules to bulk UniShield360 XML
function rulesToUnishield360Xml(rules) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ruleset name="custom-rules" description="Custom rules from dashboard">
${rules.map(r => '\n' + ruleToUnishield360Xml(r)).join('\n')}
</ruleset>`
}

// ─── UniShield360-XML-to-rule converter ───

function parseUnishield360Xml(xmlString) {
  const rules = []
  const ruleRegex = /<rule\s+([^>]*)>([\s\S]*?)<\/rule>/gi
  let match

  while ((match = ruleRegex.exec(xmlString)) !== null) {
    const attrs = match[1]
    const body = match[2]
    const id = extractAttr(attrs, 'id') || 'rule_' + Date.now()
    const level = parseInt(extractAttr(attrs, 'level') || '1')
    const overwrite = extractAttr(attrs, 'overwrite') === 'yes'
    const enabled = (body.match(/<status>([^<]*)<\/status>/i)?.[1] || 'enabled') === 'enabled'
    const description = body.match(/<description>([^<]*)<\/description>/i)?.[1] || ''
    const groups = [...body.matchAll(/<group>([^<]*)<\/group>/gi)].map(m => m[1])
    const groupIds = [...body.matchAll(/group="([^"]+)"/g)].map(m => m[1])

    // Parse field conditions
    const conditions = parseFields(body)

    rules.push({
      id,
      name: description,
      enabled,
      overwrite,
      conditionLogic: detectTopLevelLogic(body),
      conditions,
      actions: [{ type: 'alert', params: { severity: severityFromLevel(level), level, message: description } }],
      groupIds: [...new Set([...groups, ...groupIds])],
      tags: [],
      priority: level,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
  }
  return rules
}

function extractAttr(str, name) {
  const re = new RegExp(`${name}\\s*=\\s*"([^"]*)"`, 'i')
  const m = str.match(re)
  return m ? m[1] : null
}

function parseFields(xml) {
  const conditions = []
  const fieldRegex = /<field\s+name="([^"]*)"(?:\s+type="([^"]*)")?(?:\s+negate="([^"]*)")?\s*(?:\/|>)([\s\S]*?)<\/field>/gi
  let m
  while ((m = fieldRegex.exec(xml)) !== null) {
    const fieldName = m[1]
    const fieldType = m[2] || 'match'
    const negate = m[3] === 'yes'
    const inner = (m[4] || '').trim()

    let operator = 'equals'
    if (fieldType === 'regex') operator = 'regex'
    else if (fieldType === 'any') operator = 'exists'
    else if (fieldType === 'greater') operator = 'gt'
    else if (fieldType === 'greater_or_equal') operator = 'gte'
    else if (fieldType === 'less') operator = 'lt'
    else if (fieldType === 'less_or_equal') operator = 'lte'

    let value = inner
    if (fieldType === 'match' && inner.includes('<list>')) {
      operator = 'inList'
      value = [...inner.matchAll(/<list>([^<]*)<\/list>/gi)].map(x => x[1]).join(',')
    }

    conditions.push({ field: fieldName, operator, value, negate, logic: 'AND' })
  }

  // Parse AND/OR groups
  const groups = []
  const orRegex = /<or>([\s\S]*?)<\/or>/gi
  while ((m = orRegex.exec(xml)) !== null) {
    groupConditions(m[1])
  }

  return conditions
}

function detectTopLevelLogic(xml) {
  const ors = (xml.match(/<or>/g) || []).length
  const ands = (xml.match(/<and>/g) || []).length
  return ors > ands ? 'OR' : 'AND'
}

function severityFromLevel(level) {
  if (level >= 15) return 'critical'
  if (level >= 10) return 'high'
  if (level >= 7) return 'medium'
  if (level >= 4) return 'low'
  return 'info'
}

module.exports = { ruleToUnishield360Xml, rulesToUnishield360Xml, parseUnishield360Xml }
