export type DirectoryKind = 'authors' | 'publishers'

export const DIRECTORY: Record<
  DirectoryKind,
  { title: string; description: string; filterLabel: string; zambianLabel: string; zambianFilter: string; empty: string; to: '/authors/$slug' | '/publishers/$slug' }
> = {
  authors: {
    title: 'Authors',
    description: 'Every author with a book on Kuwala, Zambian writers first in mind.',
    filterLabel: 'Find an author',
    zambianLabel: 'Zambian author',
    zambianFilter: 'Zambian only',
    empty: 'No authors match',
    to: '/authors/$slug',
  },
  publishers: {
    title: 'Publishers',
    description: 'Publishers with books on Kuwala, from Lusaka presses to international houses.',
    filterLabel: 'Find a publisher',
    zambianLabel: 'Zambian publisher',
    zambianFilter: 'Zambian only',
    empty: 'No publishers match',
    to: '/publishers/$slug',
  },
}
