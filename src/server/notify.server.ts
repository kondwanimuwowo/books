import { sendEmail, type Message } from './email.server'

// What a message to a member is about, so they can later choose which ones reach their phone.
export type NotifyTopic = 'offers' | 'orders' | 'selling' | 'account'

// Every message to a member goes through here. Today that's email only; the mobile apps will
// add a push to the same person from this one place. Mail to the team, or to people without
// an account (author invites), uses sendEmail directly.
export async function notify(_topic: NotifyTopic, message: Message) {
  await sendEmail(message)
}
