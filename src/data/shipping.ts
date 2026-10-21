export type ShippingMethod = 'courier' | 'bus_parcel' | 'zampost' | 'collect'

export interface ShippingOption {
  method: ShippingMethod
  label: string
  description: string
  feeNgwee: number
  extraItemNgwee: number
  etaDays: [number, number]
}

interface Place {
  town: string
  province: string
}

// Couriers cover the big centres; everything else travels by intercity bus or Zampost.
const COURIER_TOWNS = new Set(['lusaka', 'ndola', 'kitwe', 'chingola', 'livingstone', 'kabwe'])

const sameText = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

export function shippingOptions(from: Place, to: Place): ShippingOption[] {
  const sameTown = sameText(from.town, to.town)
  const sameProvince = from.province === to.province

  if (sameTown) {
    const options: ShippingOption[] = []
    if (COURIER_TOWNS.has(from.town.trim().toLowerCase())) {
      options.push({
        method: 'courier',
        label: 'Courier to your door',
        description: `Delivery within ${from.town}`,
        feeNgwee: 5000,
        extraItemNgwee: 500,
        etaDays: [1, 2],
      })
    }
    options.push({
      method: 'collect',
      label: 'Collect from seller',
      description: `Agree a meeting point in ${from.town}`,
      feeNgwee: 0,
      extraItemNgwee: 0,
      etaDays: [0, 2],
    })
    return options
  }

  return [
    {
      method: 'bus_parcel',
      label: 'Bus parcel',
      description: 'Collect at your bus station with your order number',
      feeNgwee: sameProvince ? 6000 : 9000,
      extraItemNgwee: 1000,
      etaDays: sameProvince ? [1, 3] : [2, 5],
    },
    {
      method: 'zampost',
      label: 'Zampost',
      description: 'Collect at your nearest post office',
      feeNgwee: sameProvince ? 5000 : 7500,
      extraItemNgwee: 1000,
      etaDays: sameProvince ? [3, 7] : [5, 10],
    },
  ]
}

export function shippingFee(option: ShippingOption, itemCount: number) {
  return option.feeNgwee + Math.max(0, itemCount - 1) * option.extraItemNgwee
}

const SHIPPING_LABELS: Record<ShippingMethod, string> = {
  courier: 'Courier',
  bus_parcel: 'Bus parcel',
  zampost: 'Zampost',
  collect: 'Collect from seller',
}

export function shippingLabel(method: ShippingMethod) {
  return SHIPPING_LABELS[method]
}

// After "shipped", the buyer has this long to confirm or dispute before escrow releases by itself.
export const AUTO_RELEASE_DAYS = 7
