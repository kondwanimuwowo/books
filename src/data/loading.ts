export type LoadingKind = 'find' | 'read' | 'list'

/** How long each line stays before the next one rolls in. */
export const LOADING_LINE_MS = 2800

const SLOW_NETWORK = ['The network is taking the scenic route…', 'Slower than Cairo Road at five, but moving…', 'Still here. Still looking. Promise…', 'Nearly there. Probably…']

/**
 * Lines shown while something slow runs, grouped by how long it has taken (`after`, in ms).
 * The later groups own up to the wait, with a smile.
 */
export const LOADING_LINES: Record<LoadingKind, { after: number; lines: string[] }[]> = {
  find: [
    {
      after: 0,
      lines: ['Flipping through the shelves…', 'Reading the spines…', 'Asking the librarian…', 'Checking the back room…', 'Shushing the other books…', 'Following the smell of new pages…'],
    },
    { after: 4000, lines: ['Still looking. Books hide well…', 'This one is playing hard to get…', 'Checking behind the dictionaries…', 'Blowing the dust off the old stock…'] },
    { after: 9000, lines: SLOW_NETWORK },
  ],
  read: [
    {
      after: 0,
      lines: ['Judging the book by its cover, just this once…', 'Squinting at the small print…', 'Reading the copyright page so you don’t have to…', 'Counting the dog-ears…', 'Checking for coffee stains…'],
    },
    { after: 12000, lines: ['Still reading. It’s a good one…', 'Double-checking the ISBN…', 'Writing the blurb in our best handwriting…'] },
    { after: 25000, lines: SLOW_NETWORK },
  ],
  list: [
    {
      after: 0,
      lines: ['Deciphering the teacher’s handwriting…', 'Hunting down every title…', 'Checking every shelf, grade by grade…', 'Ticking things off…', 'Sharpening the pencils…'],
    },
    { after: 12000, lines: ['Long list. We’re on it…', 'Still hunting. No book left behind…', 'Comparing prices so you don’t have to…'] },
    { after: 25000, lines: SLOW_NETWORK },
  ],
}

/** What screen readers hear once, instead of every rolling line. */
export const LOADING_LABEL: Record<LoadingKind, string> = {
  find: 'Searching',
  read: 'Reading your photos',
  list: 'Reading your list',
}
