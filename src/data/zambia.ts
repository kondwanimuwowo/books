export const PROVINCES = [
  'Central',
  'Copperbelt',
  'Eastern',
  'Luapula',
  'Lusaka',
  'Muchinga',
  'Northern',
  'North-Western',
  'Southern',
  'Western',
] as const

export type Province = (typeof PROVINCES)[number]

export const MAJOR_TOWNS: Record<Province, string[]> = {
  Central: ['Kabwe', 'Kapiri Mposhi', 'Mkushi', 'Serenje', 'Mumbwa'],
  Copperbelt: ['Ndola', 'Kitwe', 'Chingola', 'Mufulira', 'Luanshya', 'Chililabombwe'],
  Eastern: ['Chipata', 'Katete', 'Petauke', 'Lundazi'],
  Luapula: ['Mansa', 'Samfya', 'Kawambwa', 'Nchelenge'],
  Lusaka: ['Lusaka', 'Chongwe', 'Kafue', 'Chilanga'],
  Muchinga: ['Chinsali', 'Mpika', 'Nakonde', 'Isoka'],
  Northern: ['Kasama', 'Mbala', 'Mpulungu', 'Luwingu'],
  'North-Western': ['Solwezi', 'Kasempa', 'Mwinilunga', 'Zambezi'],
  Southern: ['Livingstone', 'Choma', 'Mazabuka', 'Monze', 'Kalomo'],
  Western: ['Mongu', 'Kaoma', 'Senanga', 'Sesheke'],
}

// The seven official local languages first, so they lead the language filter.
export const LANGUAGES = [
  { code: 'bem', name: 'Bemba' },
  { code: 'nya', name: 'Nyanja' },
  { code: 'toi', name: 'Tonga' },
  { code: 'loz', name: 'Lozi' },
  { code: 'kqn', name: 'Kaonde' },
  { code: 'lun', name: 'Lunda' },
  { code: 'lue', name: 'Luvale' },
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'French' },
  { code: 'pt', name: 'Portuguese' },
] as const

export function languageName(code: string) {
  return LANGUAGES.find((l) => l.code === code)?.name ?? code.toUpperCase()
}
