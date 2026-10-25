import { env } from 'cloudflare:workers'
import { Resend } from 'resend'

interface Message {
  to: string
  subject: string
  lines: string[]
  action?: { label: string; path: string }
}

export function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

function render({ lines, action }: Message) {
  const body = lines.map((l) => `<p style="margin:0 0 12px">${l}</p>`).join('')
  const button = action
    ? `<p style="margin:20px 0"><a href="${env.APP_ORIGIN}${action.path}" style="background:#722F37;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none">${action.label}</a></p>`
    : ''
  return `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#2A1E17;max-width:520px">
<p style="margin:0 0 20px"><img src="${env.APP_ORIGIN}/brand/wordmark.png" width="160" height="32" alt="Kuwala Books" style="display:block;border:0"></p>${body}${button}
<p style="margin-top:28px;font-size:13px;color:#776453">Kuwala Books, Zambia's book marketplace</p></div>`
}

// Email must never break the flow that triggered it (payment confirmation especially).
export async function sendEmail(message: Message) {
  if (!env.RESEND_API_KEY) {
    console.log('[email skipped: no RESEND_API_KEY]', message.to, message.subject)
    return
  }
  try {
    const resend = new Resend(env.RESEND_API_KEY)
    await resend.emails.send({ from: env.EMAIL_FROM, to: message.to, subject: message.subject, html: render(message) })
  } catch (error) {
    console.error('Email send failed', message.subject, error)
  }
}
