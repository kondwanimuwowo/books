import { YANGO_TOWNS, sameTown } from './zambia'

// 'courier' and 'zampost' only appear on past orders.
export type ShippingMethod = 'yango' | 'platinum' | 'mercury' | 'bus_parcel' | 'collect' | 'courier' | 'zampost'
export type ActiveShippingMethod = Exclude<ShippingMethod, 'courier' | 'zampost'>
/** What sellers can offer today, cheapest first within each kind of trip. */
export const SHIPPING_METHODS: readonly ActiveShippingMethod[] = ['yango', 'platinum', 'mercury', 'bus_parcel', 'collect']

// Two prices: within the seller's town, or to anywhere else. 'other_province' is the stored name for
// "out of town"; 'same_province' only appears on past orders, from when there were three bands.
export type DeliveryBand = 'same_town' | 'same_province' | 'other_province'
export const DELIVERY_BANDS: readonly DeliveryBand[] = ['same_town', 'other_province']

export const BAND_LABELS: Record<DeliveryBand, string> = {
  same_town: 'In town',
  same_province: 'Same province',
  other_province: 'Out of town',
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
  method: ActiveShippingMethod
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

const METHODS: Record<ActiveShippingMethod, { label: string; describe: (from: Place, band: DeliveryBand) => string }> = {
  yango: { label: 'Yango Delivery', describe: (from) => `By motorbike, to your door in ${from.town}` },
  platinum: { label: 'Platinum Courier', describe: () => 'To you anywhere in Zambia. Drop-off queues can add a day.' },
  mercury: { label: 'Mercury Tigmoo', describe: () => 'Premium courier, tracked to your door' },
  bus_parcel: { label: 'Bus parcel', describe: () => 'Collect at your bus station with your order number' },
  collect: {
    label: 'Pick up from seller',
    describe: (from, band) => (band === 'same_town' ? `Agree a meeting point in ${from.town}` : `Pick up in ${from.town}: you, or someone you send, meets the seller`),
  },
}

const isActive = (method: ShippingMethod): method is ActiveShippingMethod => (SHIPPING_METHODS as readonly string[]).includes(method)

export function deliveryBand(from: Place, to: Place): DeliveryBand {
  return from.province === to.province && sameTown(from.town, to.town) ? 'same_town' : 'other_province'
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
    .filter((r): r is DeliveryRate & { method: ActiveShippingMethod } => r.band === band && isActive(r.method) && seller.deliveryMethods.includes(r.method))
    .filter((r) => r.method !== 'yango' || YANGO_TOWNS.some((t) => sameTown(t, from.town)))
    .map((r) => {
      const fee = r.feeNgwee + Math.max(0, order.itemCount - 1) * r.extraItemNgwee
      return {
        method: r.method,
        label: METHODS[r.method].label,
        description: METHODS[r.method].describe(from, band),
        totalNgwee: free ? 0 : fee,
        free: free && fee > 0,
        etaDays: [r.etaMinDays, r.etaMaxDays] as [number, number],
      }
    })
    .sort((a, b) => SHIPPING_METHODS.indexOf(a.method) - SHIPPING_METHODS.indexOf(b.method))
}

const SHIPPING_LABELS: Record<ShippingMethod, string> = {
  yango: 'Yango Delivery',
  platinum: 'Platinum Courier',
  mercury: 'Mercury Tigmoo',
  bus_parcel: 'Bus parcel',
  collect: 'Pick up from seller',
  courier: 'Courier',
  zampost: 'Zampost',
}

export function shippingLabel(method: ShippingMethod) {
  return SHIPPING_LABELS[method]
}

export function etaLabel([min, max]: [number, number]) {
  if (max === 0) return 'Today'
  if (min === 0 && max === 1) return 'Today or tomorrow'
  const from = Math.max(min, 1)
  if (from === max) return max === 1 ? '1 day' : `${max} days`
  return `${from}–${max} days`
}

/** The cheapest way a copy can reach a place (fastest on a tie), or null if the seller doesn't deliver there. */
export function cheapestDelivery(from: Place, to: Place, rates: DeliveryRate[], seller: SellerDelivery, priceNgwee: number) {
  const options = shippingOptions(from, to, rates, seller, { itemCount: 1, subtotalNgwee: priceNgwee })
  return options.sort((a, b) => a.totalNgwee - b.totalNgwee || a.etaDays[1] - b.etaDays[1])[0] ?? null
}

// After "shipped", the buyer has this long to confirm or dispute before escrow releases by itself.
export const AUTO_RELEASE_DAYS = 7
/** Pickup waits on the buyer (or whoever they send) getting there, so it gets longer before money is released. */
export const PICKUP_RELEASE_DAYS = 14

export const PICKUP_COPY = {
  nameHint: 'Picking up for someone else? Put their name and number; they show the order number.',
  phoneHint: 'For the courier, or whoever picks up',
  addressOptional: 'Address or landmark (not needed for pickup)',
} as const
