const axios = require('axios')

function sendWebhook(notif, eventData) {
  const payload = {
    event: eventData.type || 'rule.match',
    timestamp: new Date().toISOString(),
    data: eventData
  }

  const headers = { 'Content-Type': 'application/json' }
  if (notif.secret) headers['X-Webhook-Secret'] = notif.secret

  return axios.post(notif.url, payload, { headers, timeout: 10000 })
    .then(res => ({ ok: true, status: res.status, body: res.data }))
    .catch(err => ({ ok: false, status: err.response?.status || 0, body: err.message }))
}

async function processNotifications(db, eventData) {
  const notifs = db.getAllNotifications().filter(n => n.enabled && n.url)
  const results = []

  for (const notif of notifs) {
    const evts = notif.events || ['rule.match']
    if (!evts.includes(eventData.type)) continue

    let result
    switch (notif.type) {
      case 'webhook':
        result = await sendWebhook(notif, eventData)
        break
      default:
        result = { ok: false, body: `Unknown notification type: ${notif.type}` }
    }

    db.addNotificationLog(notif.id, eventData.type, result.ok ? 'sent' : 'failed', JSON.stringify(result))
    results.push({ notifId: notif.id, name: notif.name, ok: result.ok })
  }
  return results
}

module.exports = { processNotifications, sendWebhook }
