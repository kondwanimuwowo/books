import { env } from 'cloudflare:workers'
import { CONTACT } from '#/data/brand'
import { render, type Message } from './email.server'

const API = 'https://api.brevo.com/v3'

async function call(path: string, body: unknown) {
  if (!env.BREVO_API_KEY) {
    console.log('[brevo skipped: no BREVO_API_KEY]', path)
    return false
  }
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'api-key': env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) console.error('Brevo request failed', path, res.status, await res.text().catch(() => ''))
  return res.ok
}

function sender() {
  const match = env.NEWS_FROM.match(/^(.*?)\s*<(.+)>$/)
  return match ? { name: match[1], email: match[2] } : { email: env.NEWS_FROM }
}

// Like sendEmail: a failed send is logged and never breaks what triggered it.
export async function sendNews(message: Message) {
  try {
    const unsubscribeUrl = message.unsubscribe ? `${env.APP_ORIGIN}${message.unsubscribe.path}` : null
    await call('/smtp/email', {
      sender: sender(),
      to: [{ email: message.to }],
      replyTo: { email: CONTACT.support },
      subject: message.subject,
      htmlContent: render(message),
      // One-click unsubscribe from the mail app itself (RFC 8058), which Gmail and Yahoo expect.
      ...(unsubscribeUrl && {
        headers: { 'List-Unsubscribe': `<${unsubscribeUrl.replace('/unsubscribe?', '/api/unsubscribe?')}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
      }),
    })
  } catch (error) {
    console.error('Brevo send failed', message.subject, error)
  }
}

function listId() {
  const id = Number(env.BREVO_LIST_ID)
  if (!id) console.log('[brevo skipped: no BREVO_LIST_ID]')
  return id || null
}

/** Puts a confirmed subscriber on the Readers list, creating or updating the contact. */
export async function addToReaders(email: string, firstName: string | null) {
  const id = listId()
  if (!id) return
  await call('/contacts', { email, listIds: [id], updateEnabled: true, ...(firstName && { attributes: { FIRSTNAME: firstName } }) }).catch((error) =>
    console.error('Brevo add failed', error),
  )
}

export async function removeFromReaders(email: string) {
  const id = listId()
  if (!id) return
  await call(`/contacts/lists/${id}/contacts/remove`, { emails: [email] }).catch((error) => console.error('Brevo remove failed', error))
}
