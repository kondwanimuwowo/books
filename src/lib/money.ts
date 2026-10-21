export type Currency = 'ZMW' | 'USD'

export function formatMoney(ngwee: number, currency: Currency = 'ZMW', zmwPerUsd?: number | null) {
  if (currency === 'USD' && zmwPerUsd) {
    const usd = ngwee / 100 / zmwPerUsd
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(usd)
  }
  const hasNgwee = ngwee % 100 !== 0
  return (
    'K' +
    (ngwee / 100).toLocaleString('en-US', {
      minimumFractionDigits: hasNgwee ? 2 : 0,
      maximumFractionDigits: 2,
    })
  )
}

export function toNgwee(kwacha: number) {
  return Math.round(kwacha * 100)
}

export function ngweeToAmount(ngwee: number) {
  return (ngwee / 100).toFixed(2)
}
