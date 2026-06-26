import axios from 'axios'

export const emailService = {
  async send(to, from, subject, body, attachment = null) {
    if (!to || !subject) throw new Error('Email requires recipient and subject')

    const email = {
      id: 'email_' + Date.now(),
      to, from: from || 'noreply@unishield360.com',
      subject, body,
      attachment: attachment ? { name: attachment.name || 'report.pdf', type: attachment.type || 'application/pdf' } : null,
      sentAt: new Date().toISOString(),
      status: 'sent',
    }

    try {
      const { data } = await axios.post('/api/notifications/test', {
        type: 'email',
        name: 'Email: ' + subject,
        url: to,
        events: ['email'],
        to, from: from || 'noreply@unishield360.com', subject, body,
        attachment: !!attachment,
      })
      email.status = data?.ok ? 'delivered' : 'queued'
      email.response = data
    } catch (e) {
      email.status = 'queued'
      email.error = e.message
    }

    const sent = JSON.parse(localStorage.getItem('unishield_emails_sent') || '[]')
    sent.push(email)
    localStorage.setItem('unishield_emails_sent', JSON.stringify(sent.slice(-100)))

    return email
  },

  async sendBatch(recipients, from, subject, body, attachment = null) {
    return Promise.all(recipients.map(to => emailService.send(to, from, subject, body, attachment)))
  },

  getHistory() {
    try { return JSON.parse(localStorage.getItem('unishield_emails_sent') || '[]').reverse() }
    catch { return [] }
  },

  clearHistory() {
    localStorage.removeItem('unishield_emails_sent')
  },
}