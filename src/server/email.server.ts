import { env } from 'cloudflare:workers'
import { Resend } from 'resend'
import { CONTACT } from '#/data/brand'

export interface Message {
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
  // A white page, so the wordmark and text read the same in clients that default to a dark background.
  return `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#2A1E17;background:#ffffff;max-width:520px;padding:24px">
<p style="margin:0 0 20px"><img src="${env.APP_ORIGIN}/brand/wordmark.png" width="160" height="20" alt="Kuwala Books" style="display:block;border:0"></p>${body}${button}
<p style="margin-top:28px;font-size:13px;color:#776453">Kuwala Books, Zambia's book marketplace</p></div>`
}

/** The team's own inbox: the address part of EMAIL_FROM. */
export function teamInbox() {
  return env.EMAIL_FROM.match(/<(.+)>/)?.[1] ?? env.EMAIL_FROM
}

// Email must never break the flow that triggered it (payment confirmation especially).
export async function sendEmail(message: Message) {
  if (!env.RESEND_API_KEY) {
    console.log('[email skipped: no RESEND_API_KEY]', message.to, message.subject)
    return
  }
  try {
    const resend = new Resend(env.RESEND_API_KEY)
    await resend.emails.send({ from: env.EMAIL_FROM, replyTo: CONTACT.support, to: message.to, subject: message.subject, html: render(message) })
  } catch (error) {
    console.error('Email send failed', message.subject, error)
  }
}
