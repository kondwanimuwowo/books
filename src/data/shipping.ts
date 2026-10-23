import { COURIER_TOWNS, sameTown } from './zambia'

export type ShippingMethod = 'courier' | 'bus_parcel' | 'zampost' | 'collect'
export const SHIPPING_METHODS: readonly ShippingMethod[] = ['courier', 'bus_parcel', 'zampost', 'collect']

// Priced by how far a parcel travels, not by town: fares move too often to keep a price per town.
export type DeliveryBand = 'same_town' | 'same_province' | 'other_province'
export const DELIVERY_BANDS: readonly DeliveryBand[] = ['same_town', 'same_province', 'other_province']

export const BAND_LABELS: Record<DeliveryBand, string> = {
  same_town: 'Same town',
  same_province: 'Same province',
  other_province: 'Other province',
}

/** One row of the admin-editable price list (delivery_rates). */
export interface DeliveryRate {
  method: ShippingMethod
  band: DeliveryBand
  feeNgwee: number
  extraItemNgwee: number
  etaMinDays: number
  etaMaxDays: number
}

/** What a seller has chosen: the methods they use, and an optional spend above which delivery is on them. */
export interface SellerDelivery {
  deliveryMethods: ShippingMethod[]
  freeDeliveryOverNgwee: number | null
}

export interface ShippingOption {
  method: ShippingMethod
  label: string
  description: string
  totalNgwee: number
  /** The seller is covering delivery. */
  free: boolean
  etaDays: [number, number]
}

interface Place {
  town: string
  province: string
}

const METHODS: Record<ShippingMethod, { label: string; describe: (from: Place) => string }> = {
  courier: { label: 'Courier to your door', describe: (from) => `Delivery within ${from.town}` },
  collect: { label: 'Collect from seller', describe: (from) => `Agree a meeting point in ${from.town}` },
  bus_parcel: { label: 'Bus parcel', describe: () => 'Collect at your bus station with your order number' },
  zampost: { label: 'Zampost', describe: () => 'Collect at your nearest post office' },
}

export function deliveryBand(from: Place, to: Place): DeliveryBand {
  if (from.province === to.province && sameTown(from.town, to.town)) return 'same_town'
  return from.province === to.province ? 'same_province' : 'other_province'
}

export function shippingOptions(
  from: Place,
  to: Place,
  rates: DeliveryRate[],
  seller: SellerDelivery,
  order: { itemCount: number; subtotalNgwee: number },
): ShippingOption[] {
  const band = deliveryBand(from, to)
  const free = seller.freeDeliveryOverNgwee !== null && order.subtotalNgwee >= seller.freeDeliveryOverNgwee
  return rates
    .filter((r) => r.band === band && seller.deliveryMethods.includes(r.method))
    .filter((r) => r.method !== 'courier' || COURIER_TOWNS.some((t) => sameTown(t, from.town)))
    .map((r) => {
      const fee = r.feeNgwee + Math.max(0, order.itemCount - 1) * r.extraItemNgwee
      return {
        method: r.method,
        label: METHODS[r.method].label,
        description: METHODS[r.method].describe(from),
        totalNgwee: free ? 0 : fee,
        free: free && fee > 0,
        etaDays: [r.etaMinDays, r.etaMaxDays] as [number, number],
      }
    })
    .sort((a, b) => SHIPPING_METHODS.indexOf(a.method) - SHIPPING_METHODS.indexOf(b.method))
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
