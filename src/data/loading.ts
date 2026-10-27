export type LoadingKind = 'find' | 'read' | 'list' | 'research' | 'pay'

/** How long each line stays before the next one rolls in. */
export const LOADING_LINE_MS = 2800

/** When a wait counts as a slow network: the lines admit it, and the sell search offers a way out. */
export const SLOW_AFTER_MS = 9000

const SLOW_NETWORK = [
  'The network is taking the scenic route…',
  'Slower than Cairo Road at five, but moving…',
  'Still here. Still looking. Promise…',
  'Nearly there. Probably…',
  'Waiting for the minibus to fill up…',
  'Slow and steady, like the Great North Road on a Friday…',
  'Bundles running low? We’ll wait…',
  'Patient, like waiting for the lights to come back…',
  'Moving at the speed of a Monday morning…',
]

/**
 * Lines shown while something slow runs, grouped by how long it has taken (`after`, in ms).
 * The later groups own up to the wait, with a smile.
 */
export const LOADING_LINES: Record<LoadingKind, { after: number; lines: string[] }[]> = {
  find: [
    {
      after: 0,
      lines: [
        'Flipping through the shelves…',
        'Reading the spines…',
        'Asking the librarian…',
        'Checking the back room…',
        'Shushing the other books…',
        'Following the smell of new pages…',
        'Checking every stall on Cairo Road…',
        'Asking the auntie who knows everyone…',
        'Rummaging through the second-hand pile…',
        'Looking under the mango tree…',
        'Licking a finger to turn the pages…',
        'Peeking into school bags…',
      ],
    },
    {
      after: 4000,
      lines: [
        'Still looking. Books hide well…',
        'This one is playing hard to get…',
        'Checking behind the dictionaries…',
        'Blowing the dust off the old stock…',
        'Phoning a cousin in Kitwe…',
        'Asking the seller to check the car boot…',
        'Searching harder than for the TV remote…',
        'Checking behind the encyclopedias nobody reads…',
      ],
    },
    { after: SLOW_AFTER_MS, lines: SLOW_NETWORK },
  ],
  read: [
    {
      after: 0,
      lines: [
        'Judging the book by its cover, just this once…',
        'Squinting at the small print…',
        'Reading the copyright page so you don’t have to…',
        'Counting the dog-ears…',
        'Checking for coffee stains…',
        'Putting on our reading glasses…',
        'Holding it up to the light…',
        'Finding the ISBN behind the price sticker…',
        'Trying not to read the ending…',
        'Reading the back like a bookshop browser…',
      ],
    },
    {
      after: 12000,
      lines: [
        'Still reading. It’s a good one…',
        'Double-checking the ISBN…',
        'Writing the blurb in our best handwriting…',
        'Pretending we read it in school…',
        'Still squinting. That print is tiny…',
        'Checking the year it was printed…',
      ],
    },
    { after: 25000, lines: SLOW_NETWORK },
  ],
  list: [
    {
      after: 0,
      lines: [
        'Deciphering the teacher’s handwriting…',
        'Hunting down every title…',
        'Checking every shelf, grade by grade…',
        'Ticking things off…',
        'Sharpening the pencils…',
        'Covering the books in brown paper already…',
        'Writing names inside the covers…',
        'Skipping the uniform list…',
        'Finding the one book every school asks for…',
      ],
    },
    {
      after: 12000,
      lines: [
        'Long list. We’re on it…',
        'Still hunting. No book left behind…',
        'Comparing prices so you don’t have to…',
        'Grade 7 lists are long, hey…',
        'More books than the school bag can hold…',
        'Finding this year’s edition, not last year’s…',
      ],
    },
    { after: 25000, lines: SLOW_NETWORK },
  ],
  // Waiting for the buyer to approve the mobile money prompt on their phone.
  pay: [
    {
      after: 0,
      lines: [
        'Your phone should be buzzing about now…',
        'Waiting for your PIN, no peeking…',
        'Kwacha warming up for the trip…',
        'Telling your books to pack their bags…',
        'Checking the network tower is awake…',
        'Holding the door open for your money…',
        'Counting the ngwee twice, to be safe…',
        'Asking your phone nicely…',
        'The seller is already looking for tape…',
        'Polishing the books while we wait…',
      ],
    },
    {
      after: 20000,
      lines: [
        'No prompt yet? Check the phone is on and has signal…',
        'Prompt hiding under your messages? Have a look…',
        'Still waiting. Mobile money takes its time sometimes…',
        'Your books are patient. So are we…',
        'Approved already? We’re just waiting for the network to say so…',
      ],
    },
    { after: 60000, lines: SLOW_NETWORK },
  ],
  // Researching an author takes a minute or two of web searches.
  research: [
    {
      after: 0,
      lines: [
        'Looking them up online…',
        'Reading their author bio…',
        'Asking the publishers about them…',
        'Checking the Lusaka Book Fair programme…',
        'Finding every book they’ve written…',
        'Reading the back covers…',
        'Checking that the ISBNs are real…',
        'Looking for their website…',
      ],
    },
    {
      after: 30000,
      lines: [
        'Proper research takes a minute…',
        'Checking a second source, to be sure…',
        'Leaving out anything we can’t confirm…',
        'Writing their invite letter…',
        'Making the invite sound like us, not a robot…',
        'Nearly done. Polishing the bio…',
      ],
    },
    { after: 90000, lines: SLOW_NETWORK },
  ],
}

/** What screen readers hear once, instead of every rolling line. */
export const LOADING_LABEL: Record<LoadingKind, string> = {
  find: 'Searching',
  read: 'Reading your photos',
  list: 'Reading your list',
  research: 'Researching the author',
  pay: 'Waiting for you to approve the payment',
}
