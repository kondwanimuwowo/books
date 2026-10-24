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

// District towns, largest first. Delivery is priced by distance band, so a town only has to land in the right province.
export const TOWNS: Record<Province, string[]> = {
  Central: ['Kabwe', 'Kapiri Mposhi', 'Mkushi', 'Serenje', 'Mumbwa', 'Chibombo', 'Chisamba', 'Itezhi-Tezhi', 'Chitambo'],
  Copperbelt: ['Ndola', 'Kitwe', 'Chingola', 'Mufulira', 'Luanshya', 'Chililabombwe', 'Kalulushi', 'Masaiti', 'Mpongwe', 'Lufwanyama'],
  Eastern: ['Chipata', 'Petauke', 'Katete', 'Lundazi', 'Chadiza', 'Nyimba', 'Sinda', 'Mambwe', 'Vubwi'],
  Luapula: ['Mansa', 'Samfya', 'Kawambwa', 'Nchelenge', 'Mwense', 'Milenge', 'Chiengi'],
  Lusaka: ['Lusaka', 'Kafue', 'Chongwe', 'Chilanga', 'Chirundu', 'Rufunsa', 'Luangwa'],
  Muchinga: ['Chinsali', 'Mpika', 'Nakonde', 'Isoka', 'Mafinga', 'Chama', 'Shiwang’andu'],
  Northern: ['Kasama', 'Mbala', 'Mpulungu', 'Luwingu', 'Mporokoso', 'Mungwi', 'Kaputa', 'Chilubi'],
  'North-Western': ['Solwezi', 'Kalumbila', 'Mwinilunga', 'Kabompo', 'Kasempa', 'Zambezi', 'Mufumbwe', 'Chavuma', 'Ikelenge'],
  Southern: ['Livingstone', 'Choma', 'Mazabuka', 'Monze', 'Kalomo', 'Siavonga', 'Kazungula', 'Namwala', 'Sinazongwe', 'Gwembe', 'Pemba', 'Zimba'],
  Western: ['Mongu', 'Kaoma', 'Senanga', 'Sesheke', 'Kalabo', 'Lukulu', 'Limulunga', 'Shang’ombo', 'Sioma', 'Mulobezi'],
}

// Yango Delivery's bikes only work inside these towns, never between them.
export const YANGO_TOWNS: readonly string[] = ['Lusaka', 'Kitwe', 'Ndola', 'Livingstone']

export const sameTown = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/** The list's spelling of a town, or null when it isn't on the list. */
export function listedTown(town: string, province: string) {
  return (TOWNS[province as Province] ?? []).find((t) => sameTown(t, town)) ?? null
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
