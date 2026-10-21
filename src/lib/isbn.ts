export function cleanIsbn(input: string) {
  return input.replace(/[^0-9Xx]/g, '').toUpperCase()
}

function isbn13CheckDigit(first12: string) {
  const sum = first12.split('').reduce((acc, d, i) => acc + Number(d) * (i % 2 === 0 ? 1 : 3), 0)
  return (10 - (sum % 10)) % 10
}

export function isValidIsbn13(isbn: string) {
  return /^97[89]\d{10}$/.test(isbn) && isbn13CheckDigit(isbn.slice(0, 12)) === Number(isbn[12])
}

export function isValidIsbn10(isbn: string) {
  if (!/^\d{9}[\dX]$/.test(isbn)) return false
  const sum = isbn.split('').reduce((acc, c, i) => acc + (c === 'X' ? 10 : Number(c)) * (10 - i), 0)
  return sum % 11 === 0
}

/** A valid ISBN-13 for any valid ISBN-10/13 input, else null. */
export function toIsbn13(input: string): string | null {
  const isbn = cleanIsbn(input)
  if (isValidIsbn13(isbn)) return isbn
  if (isValidIsbn10(isbn)) {
    const core = '978' + isbn.slice(0, 9)
    return core + isbn13CheckDigit(core)
  }
  return null
}

export function looksLikeIsbn(input: string) {
  return toIsbn13(input) !== null
}
