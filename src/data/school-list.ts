export const SCHOOL_LIST_COPY = {
  title: 'School book list',
  intro: 'Photograph the list from school, or type it. We find each book on Kuwala, and you choose which to add to your bag.',
  photos: 'Photos of the list',
  addPhoto: 'Add a page',
  text: 'Or type the list',
  textHint: 'One book per line, with the author if the list gives one',
  find: 'Find these books',
  finding: 'Reading your list…',
  signIn: 'Sign in to find your books',
  notFound: 'Not on Kuwala yet',
  soldOut: 'On Kuwala, none for sale right now',
  listSays: 'List says',
  startOver: 'Start over',
  empty: 'None of these books are for sale yet. Check back soon: new copies are listed every day.',
} as const

// Photos of printed lists need small text to stay legible after the phone shrinks them.
export const LIST_PHOTO_EDGE = 2000
export const MAX_LIST_PHOTOS = 3
