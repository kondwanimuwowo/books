export const SAVED_COPY = {
  save: (title: string) => `Save ${title}`,
  unsave: (title: string) => `Remove ${title} from saved`,
  saveTitle: 'Save',
  savedTitle: 'Saved',
  follow: 'Follow',
  following: 'Following',
  unfollow: (name: string) => `Unfollow ${name}`,
  booksHeading: 'Books',
  followingHeading: 'Following',
  empty: 'Nothing saved yet',
  emptyAction: 'Browse books',
  kinds: { author: 'Author', seller: 'Shop', publisher: 'Publisher' },
} as const
