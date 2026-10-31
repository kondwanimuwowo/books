export const SAVED_COPY = {
  save: (title: string) => `Save ${title}`,
  unsave: (title: string) => `Remove ${title} from saved`,
  saveTitle: 'Save',
  savedTitle: 'Saved',
  heading: 'Saved books',
  empty: 'Nothing saved yet',
  emptyAction: 'Browse books',
} as const
