// Invites to claim an author page Kuwala prepared, and the page they land on.

/** An invite link works for this long. */
export const INVITE_DAYS = 60

export const CLAIM_COPY = {
  emailAction: 'See your page',
  emailFooter: (days: number) => `This link is just for you and works for ${days} days. If you’d rather not hear from us, open it and choose “Don’t contact me again”.`,
  title: (first: string) => `${first}, this page is yours`,
  line: 'We put together an author page from what’s public about your work. Claim it to make it yours.',
  steps: ['Create your Kuwala account', 'Add your photo and check your story', 'Get verified, then sell your books direct'],
  signedIn: 'Claim my page',
  signUp: 'Create my account',
  haveAccount: 'I already have an account',
  stop: 'Don’t contact me again',
  stopped: 'Done. We won’t contact you again about this page.',
  claimed: 'This page has already been claimed.',
  expired: 'This link has expired. Reply to our message and we’ll send a new one.',
  unclaimedLabel: 'Unclaimed page. Gathered from public sources.',
} as const
