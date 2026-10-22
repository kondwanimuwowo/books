export const QUICK_SEARCHES = [
  { label: 'Zambian authors', search: { zambian: true } },
  { label: 'School textbooks', search: { category: 'textbooks' } },
  { label: 'Used books', search: { condition: 'used' as const } },
  { label: 'Bemba', search: { language: 'bem' } },
  { label: 'Nyanja', search: { language: 'nya' } },
]

// Below this many covers the cover background looks sparse, so a plain band is shown instead.
export const MIN_WALL_COVERS = 6

