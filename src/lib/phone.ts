export type Operator = 'mtn' | 'airtel' | 'zamtel'

/** Local 10-digit form, e.g. 0971234567. Null if it isn't a Zambian mobile number. */
export function normalizeLocalPhone(input: string): string | null {
  let digits = input.replace(/\D/g, '')
  if (digits.startsWith('260')) digits = '0' + digits.slice(3)
  if (digits.length === 9) digits = '0' + digits
  return /^0[79]\d{8}$/.test(digits) ? digits : null
}

export function toMsisdn(local: string) {
  return '260' + local.slice(1)
}

export function detectOperator(input: string): Operator | null {
  const local = normalizeLocalPhone(input)
  if (!local) return null
  const prefix = local.slice(0, 3)
  if (prefix === '096' || prefix === '076') return 'mtn'
  if (prefix === '097' || prefix === '077') return 'airtel'
  if (prefix === '095' || prefix === '075') return 'zamtel'
  return null
}

export const OPERATOR_LABELS: Record<Operator, string> = {
  mtn: 'MTN MoMo',
  airtel: 'Airtel Money',
  zamtel: 'Zamtel Kwacha',
}
