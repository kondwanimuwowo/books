// Books on this shelf count as Zambian on their cards, even when the author isn't marked Zambian.
export const ZAMBIAN_CATEGORY = 'zambian-fiction'

export const CATEGORIES = [
  { slug: 'zambian-fiction', name: 'Zambian fiction' },
  { slug: 'fiction', name: 'Fiction' },
  { slug: 'african-literature', name: 'African literature' },
  { slug: 'textbooks', name: 'School textbooks' },
  { slug: 'university', name: 'University and professional' },
  { slug: 'children', name: 'Children' },
  { slug: 'early-readers', name: 'Early readers' },
  { slug: 'activity-colouring', name: 'Activity and colouring' },
  { slug: 'christian', name: 'Christian and faith' },
  { slug: 'business', name: 'Business and money' },
  { slug: 'self-help', name: 'Self-help' },
  { slug: 'history', name: 'History and politics' },
  { slug: 'biography', name: 'Biography and memoir' },
  { slug: 'poetry', name: 'Poetry' },
  { slug: 'local-languages', name: 'Local languages' },
  { slug: 'science', name: 'Science and technology' },
] as const
