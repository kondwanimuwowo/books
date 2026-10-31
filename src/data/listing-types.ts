// What a seller is listing: three tabs, each with its types. A type picks the book's section and which extra
// fields the form asks for. Types marked soon show greyed out. Shared with the apps.

export type SchoolFields = 'age' | 'levels'

export interface ListingType {
  id: string
  label: string
  note: string
  // The section new books go in; without one the seller picks.
  section?: string
  fields?: SchoolFields
  soon?: boolean
}

export interface ListingTab {
  id: 'books' | 'children' | 'campus'
  label: string
  soon?: boolean
  types: ListingType[]
}

export const LISTING_TABS: ListingTab[] = [
  {
    id: 'books',
    label: 'Books',
    types: [
      { id: 'book', label: 'Book', note: 'Any book for general reading' },
      { id: 'bundle', label: 'Bundle', note: 'Several books for one price', soon: true },
      { id: 'magazine', label: 'Magazine', note: 'Zambian magazines, by issue', soon: true },
    ],
  },
  {
    id: 'children',
    label: 'Children & school',
    types: [
      { id: 'storybook', label: 'Storybook', note: 'Picture books and children’s novels', section: 'children', fields: 'age' },
      { id: 'early-reader', label: 'Early reader', note: 'Learning-to-read series', section: 'early-readers', fields: 'age' },
      { id: 'activity', label: 'Activity & colouring', note: 'Colouring, sticker and puzzle books', section: 'activity-colouring', fields: 'age' },
      { id: 'textbook', label: 'School textbook', note: 'By grade or form, and subject', section: 'textbooks', fields: 'levels' },
      { id: 'school-set', label: 'School set', note: 'A grade’s books for one price', soon: true },
    ],
  },
  {
    id: 'campus',
    label: 'Campus',
    soon: true,
    types: [
      { id: 'campus-textbook', label: 'Textbook', note: 'By institution and course', soon: true },
      { id: 'module', label: 'Study module', note: 'From the lecturer who wrote it', soon: true },
      { id: 'past-papers', label: 'Past papers', note: 'Originals, or shared with permission', soon: true },
    ],
  },
]

export const DEFAULT_TYPE = 'book'

export function listingType(id: string) {
  return LISTING_TABS.flatMap((t) => t.types).find((t) => t.id === id) ?? LISTING_TABS[0].types[0]
}

export function tabOf(typeId: string) {
  return LISTING_TABS.find((t) => t.types.some((x) => x.id === typeId)) ?? LISTING_TABS[0]
}

/** Which extra fields a section's books carry: age for children's books, grade or form for textbooks. */
export function schoolFieldsFor(section: string | null | undefined): SchoolFields | undefined {
  return LISTING_TABS.flatMap((t) => t.types).find((t) => t.section && t.section === section)?.fields
}

/** Sections the Children & school types fill in, kept out of the Books tab's section list. */
export const CHILDREN_SECTIONS: string[] = LISTING_TABS.flatMap((t) => t.types).flatMap((t) => (t.section ? [t.section] : []))

export const LISTING_TYPE_COPY = {
  heading: 'What are you listing?',
  // One title per step of the sell form.
  steps: ['What are you listing?', 'Which book?', 'About the book', 'Your copy'],
  continue: 'Continue',
  anotherBook: 'Another book',
  aboutBook: 'About the book',
  soon: 'Soon',
  comingSoon: 'Coming soon',
  campusLine: 'Textbooks, study modules and past papers for colleges and universities. University books can go under Books until then.',
} as const
