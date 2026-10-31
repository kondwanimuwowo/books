// Children's and school books: who they're for, and for textbooks the grade or form, subject and curriculum.
// Stored on the book (books.age_bands, levels, subject, curriculum). Shared with the apps.

export const AGE_BANDS = [
  { value: '0-3', label: '0–3' },
  { value: '4-6', label: '4–6' },
  { value: '7-9', label: '7–9' },
  { value: '10-12', label: '10–12' },
  { value: 'teen', label: 'Teen' },
] as const
export type AgeBand = (typeof AGE_BANDS)[number]['value']
export const AGE_BAND_VALUES = AGE_BANDS.map((a) => a.value) as [AgeBand, ...AgeBand[]]

const grades = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => ({ value: `grade-${from + i}`, label: `Grade ${from + i}` }))
const forms = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => ({ value: `form-${from + i}`, label: `Form ${from + i}` }))

// Until 2028 schools run both curricula: the 2013 one (Grades 1–12) and the 2023 one (ECE, Grades 1–6, Forms 1–6).
export const LEVEL_GROUPS = [
  { label: 'Early childhood', levels: [{ value: 'ece', label: 'ECE' }] },
  { label: 'Primary', levels: grades(1, 7) },
  { label: 'Secondary, 2023 curriculum', note: 'Forms 1–4 are O level, 5–6 A level', levels: forms(1, 6) },
  { label: 'Secondary, 2013 curriculum', levels: grades(8, 12) },
]
export const LEVELS = LEVEL_GROUPS.flatMap((g) => g.levels)
export const LEVEL_VALUES = LEVELS.map((l) => l.value) as [string, ...string[]]

export const CURRICULA = [
  { value: '2023', label: '2023 curriculum', note: 'The new one' },
  { value: '2013', label: '2013 curriculum', note: 'The old one' },
] as const
export type Curriculum = (typeof CURRICULA)[number]['value']

/** Forms only exist in the 2023 curriculum, and Grades 7–12 only in the 2013 one; ECE and Grades 1–6 could be either. */
export function curriculumFor(levels: readonly string[]): Curriculum | 'ask' | 'mixed' {
  const isNew = levels.some((l) => l.startsWith('form-'))
  const isOld = levels.some((l) => l.startsWith('grade-') && Number(l.slice(6)) >= 7)
  if (isNew && isOld) return 'mixed'
  return isNew ? '2023' : isOld ? '2013' : 'ask'
}

// To check with a teacher: the 2023 curriculum renamed some subjects.
export const SUBJECTS = [
  { value: 'english', label: 'English' },
  { value: 'mathematics', label: 'Mathematics' },
  { value: 'science', label: 'Science' },
  { value: 'integrated-science', label: 'Integrated Science' },
  { value: 'biology', label: 'Biology' },
  { value: 'chemistry', label: 'Chemistry' },
  { value: 'physics', label: 'Physics' },
  { value: 'agricultural-science', label: 'Agricultural Science' },
  { value: 'social-studies', label: 'Social Studies' },
  { value: 'geography', label: 'Geography' },
  { value: 'history', label: 'History' },
  { value: 'civic-education', label: 'Civic Education' },
  { value: 'religious-education', label: 'Religious Education' },
  { value: 'zambian-languages', label: 'Zambian languages' },
  { value: 'literature', label: 'Literature in English' },
  { value: 'french', label: 'French' },
  { value: 'computer-studies', label: 'Computer Studies' },
  { value: 'commerce', label: 'Commerce' },
  { value: 'principles-of-accounts', label: 'Principles of Accounts' },
  { value: 'business-studies', label: 'Business Studies' },
  { value: 'home-economics', label: 'Home Economics' },
  { value: 'technology-studies', label: 'Technology Studies' },
  { value: 'design-and-technology', label: 'Design and Technology' },
  { value: 'expressive-arts', label: 'Expressive Arts' },
  { value: 'art-and-design', label: 'Art and Design' },
  { value: 'music', label: 'Music' },
  { value: 'physical-education', label: 'Physical Education' },
  { value: 'other', label: 'Other' },
] as const
export const SUBJECT_VALUES = SUBJECTS.map((s) => s.value) as [string, ...string[]]

const labelFrom = (list: readonly { value: string; label: string }[]) => (value: string) => list.find((x) => x.value === value)?.label ?? value
export const ageLabel = labelFrom(AGE_BANDS)
export const levelLabel = labelFrom(LEVELS)
export const subjectLabel = labelFrom(SUBJECTS)

/** One line for a book page or a card: "Grade 4, Grade 5 · Mathematics · 2023 curriculum", or "Ages 4–6, 7–9". */
export function schoolLine(book: { ageBands: readonly string[]; levels: readonly string[]; subject: string | null; curriculum: string | null }) {
  const parts = [
    book.levels.length ? book.levels.map(levelLabel).join(', ') : null,
    book.subject ? subjectLabel(book.subject) : null,
    book.curriculum ? `${book.curriculum} curriculum` : null,
    book.ageBands.length ? `Ages ${book.ageBands.map(ageLabel).join(', ')}` : null,
  ]
  return parts.filter(Boolean).join(' · ')
}

export const SCHOOL_COPY = {
  age: 'Age',
  ageHint: 'Pick every age it suits.',
  levels: 'Grade or form',
  levelsHint: 'Pick every one it’s used in.',
  curriculum: 'Curriculum',
  curriculumHint: 'Grades 1 to 6 are taught in both. Which is this book for?',
  bothCurricula: 'Both',
  mixed: 'Pick grades from one curriculum: Forms are the new one, Grades 7 to 12 the old.',
  subject: 'Subject',
  already: 'Already on Kuwala as',
} as const
