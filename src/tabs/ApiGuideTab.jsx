import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'
import { useApp } from '../context/AppContext'

const SECTIONS = [
  {
    title: 'UniShield360 SIEM',
    icon: 'cloud',
    color: '#EF843C',
    endpoints: [
      {
        method: 'GET', path: '/api/health',
        desc: 'API health check',
        params: [],
        example: '/api/health',
        note: 'Returns cluster status, version, node count'
      },
      {
        method: 'GET', path: '/api/indices',
        desc: 'List all indices',
        params: [
          { name: 'index', type: 'string', req: false, desc: 'Filter by index pattern (e.g. unishield360-alerts-4.x-*)' }
        ],
        example: '/api/indices?index=unishield360-*'
      },
      {
        method: 'GET', path: '/api/index-stats',
        desc: 'Get index statistics',
        params: [
          { name: 'index', type: 'string', req: true, desc: 'Index name or pattern (required)' }
        ],
        example: '/api/index-stats?index=unishield360-alerts-4.x-*'
      },
      {
        method: 'GET', path: '/api/fields',
        desc: 'List fields for an index',
        params: [
          { name: 'index', type: 'string', req: false, desc: 'Index pattern' }
        ],
        example: '/api/fields?index=unishield360-alerts-4.x-*'
      },
      {
        method: 'GET', path: '/api/count',
        desc: 'Count documents matching query',
        params: [
          { name: 'index', type: 'string', req: false, desc: 'Index pattern (default: unishield360-alerts-4.x-*)' },
          { name: 'q', type: 'string', req: false, desc: 'Query string (Lucene syntax)' },
          { name: 'start_date', type: 'string', req: false, desc: 'Start date/time (e.g. now-24h, 2024-01-01T00:00:00Z)' },
          { name: 'end_date', type: 'string', req: false, desc: 'End date/time (e.g. now)' }
        ],
        example: '/api/count?index=unishield360-alerts-4.x-*&q=rule.level:10&start_date=now-24h&end_date=now'
      },
      {
        method: 'GET', path: '/api/search',
        desc: 'Search documents (GET)',
        params: [
          { name: 'index', type: 'string', req: false, desc: 'Index pattern' },
          { name: 'q', type: 'string', req: false, desc: 'Query string (Lucene syntax)' },
          { name: 'limit', type: 'number', req: false, desc: 'Max results (default: 100)' },
          { name: 'offset', type: 'number', req: false, desc: 'Offset for pagination' },
          { name: 'sort', type: 'string', req: false, desc: 'Sort field (e.g. @timestamp)' },
          { name: 'order', type: 'string', req: false, desc: 'Sort order: asc or desc' },
          { name: 'start_date', type: 'string', req: false, desc: 'Start date/time' },
          { name: 'end_date', type: 'string', req: false, desc: 'End date/time' }
        ],
        example: '/api/search?index=unishield360-alerts-4.x-*&q=rule.level>=10&limit=10&sort=@timestamp&order=desc'
      },
      {
        method: 'POST', path: '/api/search',
        desc: 'Search documents (POST — JSON body)',
        params: [
          { name: 'Body', type: 'object', req: true, desc: 'JSON with index, q, limit, offset, sort, order, start_date, end_date, fields' }
        ],
        example: 'POST /api/search\nBody: {"index":"unishield360-alerts-4.x-*","q":"rule.level:10","limit":10}'
      },
      {
        method: 'POST', path: '/api/scan',
        desc: 'Scan/export documents',
        params: [
          { name: 'Body', type: 'object', req: true, desc: 'JSON with index, q, limit, fields, start_date, end_date' }
        ],
        example: 'POST /api/scan\nBody: {"index":"unishield360-alerts-4.x-*","q":"*","limit":1000}',
        note: 'Use for bulk data export. Supports large result sets.'
      },
      {
        method: 'GET', path: '/api/aggregate',
        desc: 'Aggregate/group documents',
        params: [
          { name: 'index', type: 'string', req: false, desc: 'Index pattern' },
          { name: 'field', type: 'string', req: true, desc: 'Field to aggregate on (e.g. rule.level, agent.name)' },
          { name: 'type', type: 'string', req: true, desc: 'Aggregation type: terms, date_histogram, avg, sum, min, max' },
          { name: 'interval', type: 'string', req: false, desc: 'Date histogram interval (e.g. 1h, 1d, 1M) — only for date_histogram' },
          { name: 'limit', type: 'number', req: false, desc: 'Max buckets (default: 10)' },
          { name: 'q', type: 'string', req: false, desc: 'Query filter' },
          { name: 'start_date', type: 'string', req: false, desc: 'Start date/time' },
          { name: 'end_date', type: 'string', req: false, desc: 'End date/time' }
        ],
        example: '/api/aggregate?index=unishield360-alerts-4.x-*&field=rule.level&type=terms&limit=20&start_date=now-7d'
      },
      {
        method: 'GET', path: '/api/geo',
        desc: 'Geo-spatial data',
        params: [
          { name: 'index', type: 'string', req: false, desc: 'Index pattern' },
          { name: 'q', type: 'string', req: false, desc: 'Query filter' },
          { name: 'start_date', type: 'string', req: false, desc: 'Start date/time' },
          { name: 'end_date', type: 'string', req: false, desc: 'End date/time' }
        ],
        example: '/api/geo?index=unishield360-alerts-4.x-*&start_date=now-24h'
      },
      {
        method: 'GET', path: '/api/dashboard',
        desc: 'Dashboard aggregation (multi-metric)',
        params: [
          { name: 'index', type: 'string', req: false, desc: 'Index pattern (default: unishield360-alerts-4.x-*)' },
          { name: 'start_date', type: 'string', req: false, desc: 'Start date/time (default: now-24h)' },
          { name: 'end_date', type: 'string', req: false, desc: 'End date/time (default: now)' }
        ],
        example: '/api/dashboard?index=unishield360-alerts-4.x-*&start_date=now-7d',
        note: 'Returns count24, count7d, count30d, byLevel, topRules, topAgents, timeline, categories, recent'
      },
      {
        method: 'GET', path: '/api/compliance',
        desc: 'Compliance framework data',
        params: [
          { name: 'index', type: 'string', req: false, desc: 'Index pattern' },
          { name: 'framework', type: 'string', req: false, desc: 'Filter by framework: PCI-DSS, HIPAA, GDPR, TSC (SOC 2), MITRE ATT&CK' },
          { name: 'start_date', type: 'string', req: false, desc: 'Start date/time' },
          { name: 'end_date', type: 'string', req: false, desc: 'End date/time' }
        ],
        example: '/api/compliance?framework=PCI-DSS&start_date=now-7d'
      },
      {
        method: 'GET', path: '/api/windows-dashboard',
        desc: 'Windows events dashboard',
        params: [
          { name: 'index', type: 'string', req: false, desc: 'Index pattern' },
          { name: 'start_date', type: 'string', req: false, desc: 'Start date/time' },
          { name: 'end_date', type: 'string', req: false, desc: 'End date/time' }
        ],
        example: '/api/windows-dashboard?index=unishield360-alerts-4.x-*&start_date=now-24h',
        note: 'Auto-filters rule.groups:windows. Returns event IDs, logon failures, process data.'
      },
      {
        method: 'GET', path: '/api/wazuh-rules',
        desc: 'Proxy: list Wazuh/UniShield360 rules from manager',
        params: [
          { name: 'q', type: 'string', req: false, desc: 'Query filter' },
          { name: 'limit', type: 'number', req: false, desc: 'Max results' }
        ],
        example: '/api/wazuh-rules?limit=20'
      },
      {
        method: 'POST', path: '/api/wazuh-rules',
        desc: 'Proxy: create rule on manager',
        params: [
          { name: 'Body', type: 'object', req: true, desc: 'Rule definition JSON' }
        ],
        example: 'POST /api/wazuh-rules\nBody: {"name":"custom-rule","conditions":[...],"actions":[...]}'
      },
      {
        method: 'PUT', path: '/api/wazuh-rules/:id',
        desc: 'Proxy: update rule on manager',
        params: [
          { name: 'id', type: 'string', req: true, desc: 'Rule ID (URL param)' },
          { name: 'Body', type: 'object', req: true, desc: 'Updated rule fields' }
        ],
        example: 'PUT /api/wazuh-rules/100\nBody: {"name":"updated-rule"}'
      },
      {
        method: 'DELETE', path: '/api/wazuh-rules/:id',
        desc: 'Proxy: delete rule from manager',
        params: [
          { name: 'id', type: 'string', req: true, desc: 'Rule ID (URL param)' }
        ],
        example: 'DELETE /api/wazuh-rules/100'
      },
      {
        method: 'GET', path: '/api/wazuh-decoders',
        desc: 'Proxy: list decoders from manager',
        params: [
          { name: 'q', type: 'string', req: false, desc: 'Query filter' },
          { name: 'limit', type: 'number', req: false, desc: 'Max results' }
        ],
        example: '/api/wazuh-decoders?limit=20'
      },
      {
        method: 'POST', path: '/api/wazuh-decoders',
        desc: 'Proxy: create decoder on manager',
        params: [
          { name: 'Body', type: 'object', req: true, desc: 'Decoder definition JSON' }
        ],
        example: 'POST /api/wazuh-decoders\nBody: {"name":"custom-decoder","regex":"..."}'
      },
      {
        method: 'PUT', path: '/api/wazuh-decoders/:id',
        desc: 'Proxy: update decoder on manager',
        params: [
          { name: 'id', type: 'string', req: true, desc: 'Decoder ID' },
          { name: 'Body', type: 'object', req: true, desc: 'Updated decoder fields' }
        ],
        example: 'PUT /api/wazuh-decoders/100\nBody: {"name":"updated-decoder"}'
      },
      {
        method: 'DELETE', path: '/api/wazuh-decoders/:id',
        desc: 'Proxy: delete decoder from manager',
        params: [
          { name: 'id', type: 'string', req: true, desc: 'Decoder ID' }
        ],
        example: 'DELETE /api/wazuh-decoders/100'
      }
    ]
  },
  {
    title: 'Local CRUD - Rules (SQLite)',
    icon: 'settings',
    color: '#8b5cf6',
    endpoints: [
      {
        method: 'GET', path: '/api/rules',
        desc: 'List all local rules',
        params: [],
        example: '/api/rules'
      },
      {
        method: 'POST', path: '/api/rules',
        desc: 'Create a new local rule',
        params: [
          { name: 'Body', type: 'object', req: true, desc: 'Rule object with name, conditions, actions, groupId, enabled, frequency, timeframe, timeframeUnit' }
        ],
        example: 'POST /api/rules\nBody: {"name":"Brute Force","conditions":[{"field":"data.action","operator":"equals","value":"failed"}],"actions":[{"type":"alert","params":{"severity":"high","level":10}}],"enabled":true}'
      },
      {
        method: 'GET', path: '/api/rules/:id',
        desc: 'Get rule by ID',
        params: [
          { name: 'id', type: 'string', req: true, desc: 'Rule UUID' }
        ],
        example: '/api/rules/a1b2c3d4-...'
      },
      {
        method: 'PUT', path: '/api/rules/:id',
        desc: 'Update rule',
        params: [
          { name: 'id', type: 'string', req: true, desc: 'Rule UUID' },
          { name: 'Body', type: 'object', req: true, desc: 'Fields to update' }
        ],
        example: 'PUT /api/rules/a1b2c3d4-...\nBody: {"enabled":false,"name":"Disabled Rule"}'
      },
      {
        method: 'DELETE', path: '/api/rules/:id',
        desc: 'Delete rule',
        params: [
          { name: 'id', type: 'string', req: true, desc: 'Rule UUID' }
        ],
        example: 'DELETE /api/rules/a1b2c3d4-...'
      },
      {
        method: 'POST', path: '/api/rules/:id/toggle',
        desc: 'Toggle rule enabled/disabled',
        params: [
          { name: 'id', type: 'string', req: true, desc: 'Rule UUID' }
        ],
        example: 'POST /api/rules/a1b2c3d4-.../toggle'
      },
      {
        method: 'GET', path: '/api/rules/groups',
        desc: 'List all rule groups',
        params: [],
        example: '/api/rules/groups'
      },
      {
        method: 'POST', path: '/api/rules/groups',
        desc: 'Create a rule group',
        params: [
          { name: 'Body', type: 'object', req: true, desc: 'Group object with name, color, description' }
        ],
        example: 'POST /api/rules/groups\nBody: {"name":"Windows Security","color":"#EF843C","description":"Windows event rules"}'
      },
      {
        method: 'PUT', path: '/api/rules/groups/:id',
        desc: 'Update rule group',
        params: [
          { name: 'id', type: 'string', req: true, desc: 'Group UUID' },
          { name: 'Body', type: 'object', req: true, desc: 'Updated group fields' }
        ],
        example: 'PUT /api/rules/groups/a1b2...\nBody: {"name":"Updated Group Name"}'
      },
      {
        method: 'DELETE', path: '/api/rules/groups/:id',
        desc: 'Delete rule group',
        params: [
          { name: 'id', type: 'string', req: true, desc: 'Group UUID' }
        ],
        example: 'DELETE /api/rules/groups/a1b2...'
      },
      {
        method: 'POST', path: '/api/rules/:id/evaluate',
        desc: 'Evaluate a rule against a document',
        params: [
          { name: 'id', type: 'string', req: true, desc: 'Rule UUID' },
          { name: 'Body', type: 'object', req: true, desc: 'Document to evaluate: {"doc": {...}}' }
        ],
        example: 'POST /api/rules/a1b2.../evaluate\nBody: {"doc":{"data":{"action":"failed"},"rule":{"level":10}}}'
      },
      {
        method: 'POST', path: '/api/rules/evaluate-all',
        desc: 'Evaluate all enabled rules against a document',
        params: [
          { name: 'Body', type: 'object', req: true, desc: 'Document to evaluate: {"doc": {...}}' }
        ],
        example: 'POST /api/rules/evaluate-all\nBody: {"doc":{"data.action":"failed"}}'
      },
      {
        method: 'POST', path: '/api/rules/batch-evaluate',
        desc: 'Batch evaluate all rules against multiple documents',
        params: [
          { name: 'Body', type: 'object', req: true, desc: 'Array of documents: {"docs": [{...}, {...}]}' }
        ],
        example: 'POST /api/rules/batch-evaluate\nBody: {"docs":[{"field":"val1"},{"field":"val2"}]}'
      },
      {
        method: 'GET', path: '/api/rules/export-wazuh',
        desc: 'Export rules as Wazuh XML',
        params: [
          { name: 'ids', type: 'string', req: false, desc: 'Comma-separated rule UUIDs (omit for all)' }
        ],
        example: '/api/rules/export-wazuh?ids=a1b2...,c3d4...'
      },
      {
        method: 'POST', path: '/api/rules/import-wazuh',
        desc: 'Import rules from Wazuh XML',
        params: [
          { name: 'Body', type: 'object', req: true, desc: 'XML string: {"xml": "<group...>"}' }
        ],
        example: 'POST /api/rules/import-wazuh\nBody: {"xml":"<?xml version=\\"1.0\\"?>\\n<group...>"}'
      },
      {
        method: 'GET', path: '/api/rules/:id/versions',
        desc: 'Get version history for a rule',
        params: [
          { name: 'id', type: 'string', req: true, desc: 'Rule UUID' }
        ],
        example: '/api/rules/a1b2.../versions'
      },
      {
        method: 'POST', path: '/api/rules/:id/versions',
        desc: 'Save a new version snapshot',
        params: [
          { name: 'id', type: 'string', req: true, desc: 'Rule UUID' },
          { name: 'Body', type: 'object', req: true, desc: '{"comment": "Reason for version save"}' }
        ],
        example: 'POST /api/rules/a1b2.../versions\nBody: {"comment":"Updated thresholds"}'
      },
      {
        method: 'POST', path: '/api/rules/:id/rollback/:version',
        desc: 'Rollback rule to specific version',
        params: [
          { name: 'id', type: 'string', req: true, desc: 'Rule UUID' },
          { name: 'version', type: 'number', req: true, desc: 'Version number to rollback to' }
        ],
        example: 'POST /api/rules/a1b2.../rollback/2'
      },
      {
        method: 'POST', path: '/api/search/enriched',
        desc: 'Search + decode logs + evaluate rules in one call',
        params: [
          { name: 'Body', type: 'object', req: true, desc: 'Search params with index, q, limit, sort, order, start_date, end_date' }
        ],
        example: 'POST /api/search/enriched\nBody: {"index":"unishield360-alerts-4.x-*","limit":10}',
        note: 'Returns decoded fields, rule matches, and raw search results'
      }
    ]
  },
  {
    title: 'Local CRUD - Decoders (SQLite)',
    icon: 'decode',
    color: '#10b981',
    endpoints: [
      {
        method: 'GET', path: '/api/decoders',
        desc: 'List all decoders',
        params: [],
        example: '/api/decoders'
      },
      {
        method: 'POST', path: '/api/decoders',
        desc: 'Create a decoder',
        params: [
          { name: 'Body', type: 'object', req: true, desc: 'Decoder object with name, regex, fields, order' }
        ],
        example: 'POST /api/decoders\nBody: {"name":"SSH Decoder","regex":"Failed password for .* from (?<src_ip>\\S+)","fields":[{"key":"src_ip","type":"ip"}],"order":1}'
      },
      {
        method: 'GET', path: '/api/decoders/:id',
        desc: 'Get decoder by ID',
        params: [
          { name: 'id', type: 'string', req: true, desc: 'Decoder UUID' }
        ],
        example: '/api/decoders/a1b2c3d4-...'
      },
      {
        method: 'PUT', path: '/api/decoders/:id',
        desc: 'Update decoder',
        params: [
          { name: 'id', type: 'string', req: true, desc: 'Decoder UUID' },
          { name: 'Body', type: 'object', req: true, desc: 'Updated decoder fields' }
        ],
        example: 'PUT /api/decoders/a1b2...\nBody: {"name":"Updated Decoder Name"}'
      },
      {
        method: 'DELETE', path: '/api/decoders/:id',
        desc: 'Delete decoder',
        params: [
          { name: 'id', type: 'string', req: true, desc: 'Decoder UUID' }
        ],
        example: 'DELETE /api/decoders/a1b2c3d4-...'
      }
    ]
  },
  {
    title: 'Local CRUD - Users & Auth',
    icon: 'security',
    color: '#ef4444',
    endpoints: [
      {
        method: 'POST', path: '/api/auth/login',
        desc: 'Login and get JWT token',
        params: [
          { name: 'Body', type: 'object', req: true, desc: '{"username": "...", "password": "..."}' }
        ],
        example: 'POST /api/auth/login\nBody: {"username":"admin","password":"admin123"}',
        note: 'Returns token, user object, and expiry'
      },
      {
        method: 'GET', path: '/api/auth/me',
        desc: 'Get current user profile',
        params: [
          { name: 'Authorization', type: 'header', req: true, desc: 'Bearer <token>' }
        ],
        example: 'GET /api/auth/me\nHeader: Authorization: Bearer <token>'
      },
      {
        method: 'POST', path: '/api/auth/logout',
        desc: 'Logout (invalidate session)',
        params: [
          { name: 'Authorization', type: 'header', req: true, desc: 'Bearer <token>' }
        ],
        example: 'POST /api/auth/logout\nHeader: Authorization: Bearer <token>'
      },
      {
        method: 'GET', path: '/api/users',
        desc: 'List all users (admin only)',
        params: [
          { name: 'Authorization', type: 'header', req: true, desc: 'Bearer <token>' }
        ],
        example: 'GET /api/users'
      },
      {
        method: 'POST', path: '/api/users',
        desc: 'Create new user (admin only)',
        params: [
          { name: 'Authorization', type: 'header', req: true, desc: 'Bearer <token>' },
          { name: 'Body', type: 'object', req: true, desc: '{"username":"...","password":"...","role":"admin|analyst|viewer"}' }
        ],
        example: 'POST /api/users\nBody: {"username":"analyst1","password":"securepass","role":"analyst"}'
      },
      {
        method: 'PUT', path: '/api/users/:id',
        desc: 'Update user (admin only)',
        params: [
          { name: 'Authorization', type: 'header', req: true, desc: 'Bearer <token>' },
          { name: 'id', type: 'string', req: true, desc: 'User UUID' },
          { name: 'Body', type: 'object', req: true, desc: 'Fields to update' }
        ],
        example: 'PUT /api/users/a1b2...\nBody: {"role":"viewer"}'
      },
      {
        method: 'DELETE', path: '/api/users/:id',
        desc: 'Delete user (admin only)',
        params: [
          { name: 'Authorization', type: 'header', req: true, desc: 'Bearer <token>' },
          { name: 'id', type: 'string', req: true, desc: 'User UUID' }
        ],
        example: 'DELETE /api/users/a1b2c3d4-...'
      }
    ]
  },
  {
    title: 'Settings & Notifications',
    icon: 'settings',
    color: '#06b6d4',
    endpoints: [
      {
        method: 'GET', path: '/api/settings',
        desc: 'Get dashboard settings',
        params: [
          { name: 'Authorization', type: 'header', req: true, desc: 'Bearer <token>' }
        ],
        example: '/api/settings',
        note: 'Returns pollInterval, jwtExpiry, user info'
      },
      {
        method: 'GET', path: '/api/notifications',
        desc: 'List notifications (admin only)',
        params: [
          { name: 'Authorization', type: 'header', req: true, desc: 'Bearer <token>' }
        ],
        example: '/api/notifications'
      },
      {
        method: 'POST', path: '/api/notifications',
        desc: 'Create notification webhook (admin only)',
        params: [
          { name: 'Authorization', type: 'header', req: true, desc: 'Bearer <token>' },
          { name: 'Body', type: 'object', req: true, desc: 'Notification config with name, url, events, enabled' }
        ],
        example: 'POST /api/notifications\nBody: {"name":"Slack Alerts","url":"https://hooks.slack.com/...","events":["alert","match"],"enabled":true}'
      },
      {
        method: 'PUT', path: '/api/notifications/:id',
        desc: 'Update notification (admin only)',
        params: [
          { name: 'Authorization', type: 'header', req: true, desc: 'Bearer <token>' },
          { name: 'id', type: 'string', req: true, desc: 'Notification UUID' },
          { name: 'Body', type: 'object', req: true, desc: 'Updated notification fields' }
        ],
        example: 'PUT /api/notifications/a1b2...\nBody: {"enabled":false}'
      },
      {
        method: 'DELETE', path: '/api/notifications/:id',
        desc: 'Delete notification (admin only)',
        params: [
          { name: 'Authorization', type: 'header', req: true, desc: 'Bearer <token>' },
          { name: 'id', type: 'string', req: true, desc: 'Notification UUID' }
        ],
        example: 'DELETE /api/notifications/a1b2...'
      },
      {
        method: 'POST', path: '/api/notifications/test',
        desc: 'Test notification webhook (admin only)',
        params: [
          { name: 'Authorization', type: 'header', req: true, desc: 'Bearer <token>' },
          { name: 'Body', type: 'object', req: true, desc: 'Notification config to test' }
        ],
        example: 'POST /api/notifications/test\nBody: {"url":"https://hooks.slack.com/...","name":"Test"}'
      },
      {
        method: 'GET', path: '/api/notifications/logs',
        desc: 'Get notification delivery logs (admin only)',
        params: [
          { name: 'Authorization', type: 'header', req: true, desc: 'Bearer <token>' }
        ],
        example: '/api/notifications/logs'
      },
      {
        method: 'GET', path: '/api/realtime/stats',
        desc: 'Get realtime engine statistics',
        params: [],
        example: '/api/realtime/stats'
      }
    ]
  }
]

const Q_SYNTAX = [
  { token: '*', desc: 'Wildcard — matches any value', example: 'rule.level:*' },
  { token: 'AND', desc: 'Logical AND', example: 'rule.level:10 AND agent.name:server1' },
  { token: 'OR', desc: 'Logical OR', example: 'rule.level:10 OR rule.level:12' },
  { token: 'NOT / -', desc: 'Negation', example: 'NOT rule.level:3  or  -rule.level:3' },
  { token: '> >= < <=', desc: 'Numeric comparison', example: 'rule.level:>=10' },
  { token: ':', desc: 'Field:value match', example: 'agent.name:"windows-server"' },
  { token: '()', desc: 'Grouping expressions', example: '(rule.level:>=10 AND rule.groups:windows)' },
  { token: '""', desc: 'Phrase match (exact string)', example: 'rule.description:"Failed logon"' },
  { token: '_exists_', desc: 'Field existence check', example: '_exists_:rule.pci_dss' },
  { token: 'wildcard', desc: 'Wildcard in values (*, ?)', example: 'agent.name:win*' }
]

const DATE_PRESETS = [
  { key: 'now-24h', label: 'Last 24 hours' },
  { key: 'now-7d', label: 'Last 7 days' },
  { key: 'now-30d', label: 'Last 30 days' },
  { key: 'now-1h', label: 'Last hour' },
  { key: 'now-15m', label: 'Last 15 minutes' },
  { key: 'now-1M', label: 'Last month' },
  { key: 'now-1y', label: 'Last year' }
]

const INDEX_PATTERNS = [
  { pattern: 'unishield360-alerts-4.x-*', desc: 'Main alerts index (auto-mapped to wazuh-alerts-4.x-*)' },
  { pattern: 'unishield360-archives-4.x-*', desc: 'Archived alerts' },
  { pattern: 'unishield360-states-4.x-*', desc: 'Agent state information' },
  { pattern: 'unishield360-events-4.x-*', desc: 'Raw events (non-alert)' }
]

function Badge({ method }) {
  const styles = {
    GET: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    POST: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
    PUT: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    DELETE: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
  }
  return (
    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border shrink-0 tracking-wider ${styles[method] || 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20'}`}>
      {method}
    </span>
  )
}

function Section({ title, color, children, defaultOpen, count }) {
  const [open, setOpen] = useState(defaultOpen !== false)
  return (
    <div className="border border-zinc-200/70 dark:border-zinc-700/40 rounded-xl overflow-hidden bg-white/40 dark:bg-zinc-900/20 backdrop-blur-sm shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] dark:shadow-[0_1px_2px_0_rgba(0,0,0,0.2)]">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-zinc-50/80 dark:bg-zinc-800/40 text-sm font-semibold text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100/80 dark:hover:bg-zinc-800/60 transition-all duration-150">
        <span className="w-3 h-3 rounded-full shrink-0 ring-2 ring-white/50 dark:ring-zinc-900/50" style={{ backgroundColor: color }} />
        <span className="flex-1 text-left tracking-tight">{title}</span>
        {count !== undefined && (
          <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded-md bg-zinc-200/60 dark:bg-zinc-700/60 text-zinc-500 dark:text-zinc-400">
            {count}
          </span>
        )}
        <svg className={`w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && <div className="px-4 pb-4 pt-3 text-[13px] text-zinc-600 dark:text-zinc-400 space-y-3">{children}</div>}
    </div>
  )
}

function EndpointCard({ ep, sectionTitle, onTry, onDebug, debugLoading, debuggingPath }) {
  return (
    <div className="group relative bg-white dark:bg-zinc-800/60 rounded-xl border border-zinc-200/70 dark:border-zinc-700/40 p-4 shadow-[0_1px_2px_0_rgba(0,0,0,0.03)] hover:shadow-[0_4px_12px_0_rgba(0,0,0,0.06)] dark:hover:shadow-[0_4px_12px_0_rgba(0,0,0,0.3)] transition-all duration-200 hover:border-zinc-300 dark:hover:border-zinc-600">
      <div className="flex items-center gap-2.5 mb-2">
        <Badge method={ep.method} />
        <code className="text-xs font-mono font-bold text-zinc-800 dark:text-zinc-100 break-all tracking-tight">{ep.path}</code>
      </div>
      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed mb-3 font-medium">{ep.desc}</p>
      {ep.params.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <svg className="w-3 h-3 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>
            </svg>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Params</span>
          </div>
          <div className="space-y-1">
            {ep.params.map((p, i) => (
              <div key={i} className="flex items-start gap-2 text-[11px] leading-relaxed">
                <code className="font-mono font-semibold text-[#EF843C] dark:text-[#EF843C] shrink-0">{p.name}</code>
                <span className={`text-[9px] font-mono font-medium px-1 rounded shrink-0 mt-0.5 ${
                  p.req
                    ? 'bg-rose-50 text-rose-500 dark:bg-rose-900/20 dark:text-rose-400 border border-rose-200/50 dark:border-rose-700/30'
                    : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-700/40 dark:text-zinc-500 border border-zinc-200/50 dark:border-zinc-600/30'
                }`}>
                  {p.req ? 'required' : 'optional'}
                </span>
                <span className="text-zinc-500 dark:text-zinc-400 flex-1">{p.desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="mb-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg px-3 py-2 border border-zinc-100 dark:border-zinc-700/30">
        <div className="flex items-center gap-1.5 mb-1">
          <svg className="w-3 h-3 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
          </svg>
          <span className="text-[9px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Example</span>
        </div>
        <code className="block text-[11px] font-mono text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap break-all leading-relaxed">{ep.example}</code>
      </div>
      {ep.note && (
        <div className="flex items-start gap-1.5 mb-3 text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-900/10 rounded-lg px-3 py-2 border border-amber-200/50 dark:border-amber-700/20">
          <svg className="w-3.5 h-3.5 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
          <span>{ep.note}</span>
        </div>
      )}
      <div className="flex gap-1.5">
        <button onClick={() => onDebug(ep, sectionTitle)}
          disabled={debugLoading && debuggingPath === ep.path}
          className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-[10px] font-semibold rounded-lg bg-zinc-100 dark:bg-zinc-700/40 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700/60 border border-zinc-200 dark:border-zinc-600/50 transition-all duration-150 active:scale-[0.98] disabled:opacity-50">
          {debugLoading && debuggingPath === ep.path ? (
            <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
          )}
          Debug
        </button>
        <button onClick={() => onTry(ep, sectionTitle)}
          className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-[10px] font-semibold rounded-lg bg-gradient-to-r from-[#EF843C] to-[#e0752a] text-white hover:from-[#e0752a] hover:to-[#d0661a] dark:from-[#EF843C] dark:to-[#d0661a] dark:hover:from-[#e0752a] dark:hover:to-[#c05c10] transition-all duration-150 shadow-[0_1px_3px_0_rgba(239,132,60,0.3)] hover:shadow-[0_2px_8px_0_rgba(239,132,60,0.4)] active:scale-[0.98]">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          Console
        </button>
      </div>
    </div>
  )
}

const GUIDE_CATEGORY = {
  'UniShield360 SIEM': 'UniShield360 SIEM',
  'Local CRUD - Rules (SQLite)': 'Local CRUD - Rules',
  'Local CRUD - Decoders (SQLite)': 'Local CRUD - Decoders',
  'Local CRUD - Users & Auth': 'Local CRUD - Users & Auth',
  'Settings & Notifications': 'Local CRUD - Users & Auth'
}

function FilterChip({ active, onClick, children, color }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg border transition-all duration-150 ${
        active
          ? 'text-white border-transparent shadow-[0_1px_3px_0_rgba(0,0,0,0.15)]'
          : 'text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 bg-white/50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-700/50 hover:border-zinc-300 dark:hover:border-zinc-600'
      }`}
      style={active ? { backgroundColor: color || '#EF843C', borderColor: color || '#EF843C' } : {}}>
      {children}
    </button>
  )
}

export default function ApiGuideTab() {
  const { setTab, setPendingApiEndpoint } = useApp()
  const [search, setSearch] = useState('')
  const [activeSection, setActiveSection] = useState(null)
  const [debugResult, setDebugResult] = useState(null)
  const [debugLoading, setDebugLoading] = useState(false)
  const [debuggingPath, setDebuggingPath] = useState(null)

  const filtered = SECTIONS.map(s => ({
    ...s,
    endpoints: s.endpoints.filter(ep => {
      if (!search) return true
      const q = search.toLowerCase()
      return ep.path.toLowerCase().includes(q) ||
        ep.desc.toLowerCase().includes(q) ||
        ep.method.toLowerCase().includes(q) ||
        ep.params.some(p => p.name.toLowerCase().includes(q))
    })
  })).filter(s => s.endpoints.length > 0)

  const tryInConsole = (ep, sectionTitle) => {
    const category = GUIDE_CATEGORY[sectionTitle] || 'UniShield360 SIEM'
    const consolePath = ep.path.replace('/api', '')
    const defaults = {}
    for (const p of ep.params) {
      if (p.name === 'index') defaults[p.name] = 'unishield360-alerts-4.x-*'
      else if (p.name === 'start_date') defaults[p.name] = 'now-7d'
      else if (p.name === 'end_date') defaults[p.name] = 'now'
      else if (p.name === 'limit') defaults[p.name] = '10'
      else if (p.name === 'sort') defaults[p.name] = '@timestamp'
      else if (p.name === 'order') defaults[p.name] = 'desc'
      else if (p.name === 'field') defaults[p.name] = 'rule.level'
      else if (p.name === 'type') defaults[p.name] = 'terms'
      else if (p.name === 'interval') defaults[p.name] = '1h'
      else if (p.name === 'q') defaults[p.name] = ''
    }
    setPendingApiEndpoint({ method: ep.method, path: consolePath, params: defaults, category, sectionTitle })
    setTab('apiconsole')
  }

  const debugEndpoint = async (ep, sectionTitle) => {
    if (debugLoading) return
    setDebugLoading(true)
    setDebugResult(null)
    setDebuggingPath(ep.path)
    const startTime = performance.now()
    try {
      const headers = { 'Content-Type': 'application/json' }
      const token = localStorage.getItem('dashboard_token')
      if (token) headers['Authorization'] = `Bearer ${token}`
      const path = ep.path.replace('/api', '')
      const hasBody = ep.method === 'POST' || ep.method === 'PUT'
      let res
      if (hasBody) {
        res = await axios.post('/api' + path, {}, { headers, timeout: 30000 })
      } else {
        const queryParams = {}
        for (const p of ep.params) {
          if (p.name === 'index') queryParams[p.name] = 'unishield360-alerts-4.x-*'
          else if (p.name === 'start_date') queryParams[p.name] = 'now-24h'
          else if (p.name === 'end_date') queryParams[p.name] = 'now'
          else if (p.name === 'limit') queryParams[p.name] = '5'
        }
        const qs = new URLSearchParams(queryParams).toString()
        const fullUrl = '/api' + path + (qs ? '?' + qs : '')
        if (ep.method === 'DELETE') res = await axios.delete(fullUrl, { headers, timeout: 30000 })
        else res = await axios.get(fullUrl, { headers, timeout: 30000 })
      }
      const elapsed = Math.round(performance.now() - startTime)
      setDebugResult({ status: res.status, data: res.data, elapsed, method: ep.method, path: ep.path })
    } catch (e) {
      const elapsed = Math.round(performance.now() - startTime)
      setDebugResult({ status: e.response?.status || 0, data: e.response?.data || e.message, elapsed, error: true, method: ep.method, path: ep.path })
    } finally {
      setDebugLoading(false)
    }
  }

  const sectionColors = {
    'Quick Start': '#EF843C',
    'Query Syntax (Lucene)': '#8b5cf6',
    'Common Index Patterns': '#06b6d4',
    'Date/Time Presets': '#10b981'
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: 'easeOut' }} className="space-y-4 max-w-5xl pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 px-0.5 pb-1">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#EF843C] to-[#d0661a] flex items-center justify-center shadow-[0_2px_6px_0_rgba(239,132,60,0.3)]">
          <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 16 12 12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
        </div>
        <div>
          <h2 className="text-sm font-bold text-zinc-800 dark:text-zinc-100 tracking-tight">API Reference Guide</h2>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium">Complete documentation for all API endpoints</p>
        </div>
        <div className="flex-1" />
        <span className="text-[10px] font-mono font-medium px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 border border-zinc-200 dark:border-zinc-700">
          v2.0
        </span>
      </div>

      {/* Quick Start */}
      <Section title="Quick Start" color="#EF843C">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-white dark:bg-zinc-800/40 rounded-xl p-4 border border-zinc-200/70 dark:border-zinc-700/30 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-[#EF843C]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
              </svg>
              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-200">Base URL</span>
            </div>
            <code className="block text-[12px] font-mono font-semibold text-[#EF843C] dark:text-[#EF843C] bg-zinc-50 dark:bg-zinc-900/50 px-3 py-2 rounded-lg border border-zinc-100 dark:border-zinc-700/30">http://localhost:3000/api</code>
            <div className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1.5 font-medium">All endpoints prefixed with /api</div>
          </div>
          <div className="bg-white dark:bg-zinc-800/40 rounded-xl p-4 border border-zinc-200/70 dark:border-zinc-700/30 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-[#8b5cf6]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-200">Authentication</span>
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed space-y-1">
              <div className="flex items-start gap-2">
                <span className="text-[#EF843C] font-bold">1.</span>
                <span>POST /api/auth/login with credentials</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[#EF843C] font-bold">2.</span>
                <span>Use token as Bearer in Authorization header</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[#EF843C] font-bold">3.</span>
                <span>Protected endpoints return 401 without token</span>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-zinc-800/40 rounded-xl p-4 border border-zinc-200/70 dark:border-zinc-700/30 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-[#10b981]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>
              </svg>
              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-200">Index Convention</span>
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed space-y-1">
              <div>Use <code className="text-[#EF843C] font-mono font-semibold">unishield360-*</code> prefix</div>
              <div>Server maps <code className="text-[#EF843C] font-mono">unishield360-</code> → <code className="text-[#10b981] font-mono">wazuh-</code></div>
              <div>Response names mapped back: <code className="text-[#10b981] font-mono">wazuh-</code> → <code className="text-[#EF843C] font-mono">unishield360-</code></div>
            </div>
          </div>
        </div>
      </Section>

      {/* Query Syntax Guide */}
      <Section title="Query Syntax (Lucene)" color="#8b5cf6">
        <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mb-3 font-medium">
          Use the <code className="text-[#EF843C] font-mono font-semibold bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">q</code> parameter with Lucene query syntax:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {Q_SYNTAX.map(item => (
            <div key={item.token} className="flex items-start gap-3 px-3 py-2.5 rounded-xl bg-white dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-700/30 hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors">
              <code className="text-[12px] font-mono font-bold text-[#EF843C] dark:text-[#EF843C] whitespace-nowrap shrink-0 min-w-[48px]">{item.token}</code>
              <div className="text-[11px] min-w-0">
                <div className="text-zinc-600 dark:text-zinc-400 font-medium">{item.desc}</div>
                <div className="text-zinc-400 dark:text-zinc-500 font-mono mt-0.5 text-[10px] truncate">{item.example}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="bg-white dark:bg-zinc-800/40 rounded-xl p-3 mt-3 border border-zinc-200/60 dark:border-zinc-700/30">
          <div className="flex items-center gap-1.5 mb-2">
            <svg className="w-3.5 h-3.5 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
            </svg>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Complex Queries</span>
          </div>
          <div className="space-y-1.5">
            {[
              '(rule.level:>=10 AND rule.groups:windows) OR (rule.level:>=12 AND agent.name:server*)',
              '_exists_:rule.pci_dss AND rule.level:>=12',
              'data.win.eventId:4625 AND agent.name:DC01'
            ].map((q, i) => (
              <code key={i} className="block text-[11px] font-mono text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-900/50 px-3 py-1.5 rounded-lg border border-zinc-100 dark:border-zinc-700/30 leading-relaxed">
                {q}
              </code>
            ))}
          </div>
        </div>
      </Section>

      {/* Index Patterns */}
      <Section title="Common Index Patterns" color="#06b6d4">
        <div className="space-y-2">
          {INDEX_PATTERNS.map(ip => (
            <div key={ip.pattern} className="flex items-start gap-3 px-3 py-2.5 rounded-xl bg-white dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-700/30 hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors">
              <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 bg-[#06b6d4]" />
              <code className="text-[12px] font-mono font-bold text-[#06b6d4] dark:text-[#06b6d4] whitespace-nowrap shrink-0">{ip.pattern}</code>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">{ip.desc}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* Date Presets */}
      <Section title="Date/Time Presets" color="#10b981">
        <div className="flex flex-wrap gap-2">
          {DATE_PRESETS.map(dp => (
            <div key={dp.key} className="px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-700/30 text-[11px] font-mono hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors">
              <code className="text-[#EF843C] font-semibold">{dp.key}</code>
              <span className="text-zinc-400 dark:text-zinc-500 ml-1.5 font-medium">— {dp.label}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 text-[11px] text-zinc-400 dark:text-zinc-500 font-medium">
          ISO 8601 also supported: <code className="text-[#EF843C] font-mono font-semibold bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">2024-01-01T00:00:00Z</code>
        </div>
      </Section>

      {/* Count Query Examples */}
      <Section title="Count Query Examples (Live Data)" color="#ef4444">
        <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mb-3 font-medium">
          Use the <code className="text-[#EF843C] font-mono font-semibold bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">q</code> parameter with <code className="text-[#EF843C] font-mono font-semibold bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">/api/count</code> to get document counts:
        </p>
        <div className="space-y-2">
          {[
            { q: '*', label: 'All events', count: '3,711 (24h)' },
            { q: 'rule.level:12', label: 'Critical (Level 12)', count: '35 (24h)' },
            { q: 'rule.level:10', label: 'High (Level 10)', count: '183 (24h)' },
            { q: 'rule.level:5', label: 'Medium (Level 5)', count: '2,371 (24h)' },
            { q: 'rule.groups:windows', label: 'Windows events', count: '637 (24h)' },
            { q: 'rule.groups:pfsense', label: 'pfSense firewall', count: 'varies' },
            { q: '_exists_:rule.pci_dss', label: 'PCI-DSS tagged', count: '2,740 (24h)' },
            { q: '_exists_:rule.hipaa', label: 'HIPAA tagged', count: '2,638 (24h)' },
            { q: '_exists_:rule.gdpr', label: 'GDPR tagged', count: '2,598 (24h)' },
            { q: 'agent.name:COREGENIX', label: 'Agent COREGENIX', count: '940 (24h)' },
            { q: 'agent.name:Rayyan', label: 'Agent Rayyan', count: '774 (24h)' },
            { q: 'data.srcip:36.255.10.162', label: 'Source IP blocks', count: 'varies' },
          ].map(item => (
            <div key={item.q} className="flex items-start gap-3 px-3 py-2.5 rounded-xl bg-white dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-700/30 hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <code className="text-[11px] font-mono font-bold text-[#EF843C] dark:text-[#EF843C] break-all">{item.q}</code>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-700/60 text-zinc-500 dark:text-zinc-400 shrink-0">{item.count}</span>
                </div>
                <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">{item.label}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="bg-amber-50/50 dark:bg-amber-900/10 rounded-xl p-3 mt-3 border border-amber-200/50 dark:border-amber-700/20">
          <div className="flex items-start gap-2 text-[11px] text-amber-600 dark:text-amber-400">
            <svg className="w-3.5 h-3.5 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            <div>
              <span className="font-semibold">Note:</span> Range queries like <code className="font-mono text-[10px]">rule.level:&gt;=10</code> are NOT supported. Use exact match <code className="font-mono text-[10px]">rule.level:10</code> or OR multiple values <code className="font-mono text-[10px]">rule.level:10 OR rule.level:12</code>.
            </div>
          </div>
        </div>
      </Section>

      {/* Section Filter Tabs */}
      <div className="flex flex-wrap gap-1.5">
        <FilterChip active={!activeSection} onClick={() => setActiveSection(null)} color="#EF843C">All</FilterChip>
        {SECTIONS.map(s => (
          <FilterChip
            key={s.title}
            active={activeSection === s.title}
            onClick={() => setActiveSection(activeSection === s.title ? null : s.title)}
            color={s.color}
          >
            {s.title}
          </FilterChip>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search endpoints by path, description, method, or parameter..."
          className="w-full pl-9 pr-4 py-2.5 text-xs bg-white dark:bg-zinc-800/60 rounded-xl outline-none text-zinc-800 dark:text-zinc-100 border border-zinc-200/70 dark:border-zinc-700/40 focus:border-[#EF843C]/40 dark:focus:border-[#EF843C]/40 focus:ring-2 focus:ring-[#EF843C]/10 dark:focus:ring-[#EF843C]/10 transition-all placeholder:text-zinc-400 dark:placeholder:text-zinc-500 font-medium" />
      </div>

      {/* Endpoints by section */}
      {filtered.map(section => (
        (activeSection === null || activeSection === section.title) && (
          <Section key={section.title} title={section.title} color={section.color} count={section.endpoints.length}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {section.endpoints.map((ep, i) => (
                <EndpointCard key={i} ep={ep} sectionTitle={section.title} onTry={tryInConsole} onDebug={debugEndpoint} debugLoading={debugLoading} debuggingPath={debuggingPath} />
              ))}
            </div>
          </Section>
        )
      ))}

      {/* Debug Result Panel */}
      <AnimatePresence>
        {debugResult && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="border border-zinc-200/70 dark:border-zinc-700/40 rounded-xl overflow-hidden bg-white/80 dark:bg-zinc-900/60 backdrop-blur-sm shadow-[0_4px_16px_0_rgba(0,0,0,0.08)]">
            <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800/40 border-b border-zinc-200/70 dark:border-zinc-700/40">
              <div className="flex items-center gap-2.5">
                <svg className="w-4 h-4 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
                <span className="text-xs font-bold text-zinc-700 dark:text-zinc-200">Debug Result</span>
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
                  debugResult.method === 'GET' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                  debugResult.method === 'POST' ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' :
                  debugResult.method === 'PUT' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                  'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                }`}>{debugResult.method}</span>
                <code className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">{debugResult.path}</code>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                  {debugResult.elapsed}ms
                </span>
                <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                  debugResult.status >= 200 && debugResult.status < 300
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : debugResult.status >= 400 && debugResult.status < 500
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                }`}>
                  {debugResult.status}
                  {debugResult.status === 200 ? ' OK' : debugResult.status === 201 ? ' Created' : debugResult.status === 401 ? ' Unauthorized' : debugResult.status === 404 ? ' Not Found' : debugResult.status === 500 ? ' Error' : ''}
                </span>
                <button onClick={() => setDebugResult(null)}
                  className="p-1 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            </div>
            <pre className="text-[11px] text-zinc-700 dark:text-zinc-300 font-mono whitespace-pre-wrap overflow-auto max-h-80 p-4 leading-relaxed">
              {JSON.stringify(debugResult.data, null, 2)}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>

      {/* No results */}
      {filtered.length === 0 && (
        <div className="text-center py-12">
          <svg className="w-8 h-8 mx-auto text-zinc-300 dark:text-zinc-600 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <p className="text-sm font-medium text-zinc-400 dark:text-zinc-500">No endpoints match "<span className="text-zinc-500 dark:text-zinc-400">{search}</span>"</p>
        </div>
      )}

      {/* Footer */}
      <div className="text-center pt-4 pb-2 text-[10px] text-zinc-300 dark:text-zinc-600 font-medium tracking-wide">
        UniShield360 API Reference — 48 endpoints documented
      </div>
    </motion.div>
  )
}
