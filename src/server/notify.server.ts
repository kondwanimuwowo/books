import { sendEmail, type Message } from './email.server'
import { sendNews } from './brevo.server'

// What a message to a member is about, so they can later choose which ones reach their phone.
// 'alerts' (saved books and follows) are opt-in and go through Brevo, with an unsubscribe link.
export type NotifyTopic = 'offers' | 'orders' | 'selling' | 'account' | 'alerts'

// Every message to a member goes through here. Today that's email only; the mobile apps will
// add a push to the same person from this one place. Mail to the team, or to people without
// an account (author invites), uses sendEmail directly.
export async function notify(topic: NotifyTopic, message: Message) {
  await (topic === 'alerts' ? sendNews(message) : sendEmail(message))
}
