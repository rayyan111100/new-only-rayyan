const axios = require('axios')
const nodemailer = require('nodemailer')

let mailTransport = null

function initMailer() {
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    mailTransport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    })
    console.log('✔ SMTP mailer configured (' + process.env.SMTP_HOST + ')')
  } else {
    console.warn('⚠ SMTP not configured — email sending disabled. Set SMTP_HOST, SMTP_USER, SMTP_PASSWORD in .env')
  }
}

async function sendEmail({ to, from, subject, body, attachment }) {
  if (!mailTransport) {
    return { ok: false, status: 0, body: 'SMTP not configured' }
  }
  try {
    const mailOpts = {
      from: from || process.env.SMTP_FROM || 'noreply@unishield360.com',
      to,
      subject,
      text: body || '',
    }
    if (attachment) {
      if (typeof attachment === 'string') {
        mailOpts.attachments = [{ path: attachment }]
      } else if (attachment.content) {
        mailOpts.attachments = [{
          filename: attachment.filename || 'report.pdf',
          content: Buffer.from(attachment.content, 'base64'),
          encoding: 'base64',
        }]
      }
    }
    const info = await mailTransport.sendMail(mailOpts)
    return { ok: true, status: 200, body: 'Delivered: ' + info.messageId }
  } catch (err) {
    return { ok: false, status: 0, body: err.message }
  }
}

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
      case 'email':
        result = await sendEmail({
          to: notif.url,
          from: process.env.SMTP_FROM,
          subject: 'UniShield360 Alert: ' + (eventData.type || 'Notification'),
          body: JSON.stringify(eventData, null, 2),
        })
        break
      default:
        result = { ok: false, body: 'Unknown notification type: ' + notif.type }
    }
    db.addNotificationLog(notif.id, eventData.type, result.ok ? 'sent' : 'failed', JSON.stringify(result))
    results.push({ notifId: notif.id, name: notif.name, ok: result.ok })
  }
  return results
}

module.exports = { processNotifications, sendWebhook, sendEmail, initMailer }