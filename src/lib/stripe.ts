import Stripe from 'stripe'

// Lazy initialization to avoid build-time errors
let stripeInstance: Stripe | null = null

export function getStripe(): Stripe {
  if (!stripeInstance) {
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      typescript: true,
    })
  }
  return stripeInstance
}

// For backward compatibility - use getStripe() in new code
export const stripe = {
  get checkout() { return getStripe().checkout },
  get subscriptions() { return getStripe().subscriptions },
  get customers() { return getStripe().customers },
  get webhooks() { return getStripe().webhooks },
}

// Price IDs from environment variables
export const PRICE_IDS = {
  monthly: process.env.STRIPE_MONTHLY_PRICE_ID || '',
  annual: process.env.STRIPE_ANNUAL_PRICE_ID || '',
}

// Safe timestamp conversion - handles null/undefined values from Stripe
export const safeTimestamp = (ts: unknown): string | null => {
  if (ts === null || ts === undefined) return null
  if (typeof ts !== 'number' || isNaN(ts)) return null
  try {
    return new Date(ts * 1000).toISOString()
  } catch {
    return null
  }
}

// Map Stripe subscription status to our database status
export const mapStripeStatus = (status: string): string => {
  switch (status) {
    case 'active':
      return 'active'
    case 'trialing':
      return 'trialing'
    case 'canceled':
    case 'unpaid':
    case 'incomplete_expired':
      return 'canceled'
    case 'past_due':
    case 'incomplete':
      return 'inactive'
    default:
      return 'inactive'
  }
}