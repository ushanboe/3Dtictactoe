import { NextRequest, NextResponse } from 'next/server'
import { getStripe, safeTimestamp, mapStripeStatus } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase-server'
import Stripe from 'stripe'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    console.error('No stripe signature found')
    return NextResponse.json({ error: 'No signature' }, { status: 400 })
  }

  const stripe = getStripe()
  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json(
      { error: 'Webhook signature verification failed' },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.supabase_user_id
        const plan = session.metadata?.plan || 'monthly'

        if (!userId) {
          console.error('No user ID in session metadata')
          break
        }

        // Get subscription details
        const subscriptionId = session.subscription as string
        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        const subData = subscription as unknown as Record<string, unknown>

        const { error } = await supabase
          .from('subscriptions')
          .upsert({
            user_id: userId,
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: subscriptionId,
            plan: plan,
            status: mapStripeStatus(subscription.status),
            current_period_start: safeTimestamp(subData.current_period_start),
            current_period_end: safeTimestamp(subData.current_period_end),
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id'
          })

        if (error) {
          console.error('Error upserting subscription:', error)
        } else {
          console.log('Subscription created for user:', userId)
        }
        break
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription
        const subData = subscription as unknown as Record<string, unknown>
        const userId = subscription.metadata?.supabase_user_id

        if (!userId) {
          console.error('No user ID in subscription metadata')
          break
        }

        const plan = subscription.metadata?.plan || 'monthly'

        const { error } = await supabase
          .from('subscriptions')
          .upsert({
            user_id: userId,
            stripe_customer_id: subscription.customer as string,
            stripe_subscription_id: subscription.id,
            plan: plan,
            status: mapStripeStatus(subscription.status),
            current_period_start: safeTimestamp(subData.current_period_start),
            current_period_end: safeTimestamp(subData.current_period_end),
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id'
          })

        if (error) {
          console.error('Error updating subscription:', error)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const userId = subscription.metadata?.supabase_user_id

        if (!userId) {
          console.error('No user ID in subscription metadata')
          break
        }

        const { error } = await supabase
          .from('subscriptions')
          .update({
            status: 'canceled',
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId)

        if (error) {
          console.error('Error canceling subscription:', error)
        }
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        const invoiceData = invoice as unknown as Record<string, unknown>
        const subscriptionId = invoiceData.subscription as string | null

        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId)
          const subData = subscription as unknown as Record<string, unknown>
          const userId = subscription.metadata?.supabase_user_id

          if (userId) {
            await supabase
              .from('subscriptions')
              .update({
                status: 'active',
                current_period_start: safeTimestamp(subData.current_period_start),
                current_period_end: safeTimestamp(subData.current_period_end),
                updated_at: new Date().toISOString(),
              })
              .eq('user_id', userId)
          }
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const invoiceData = invoice as unknown as Record<string, unknown>
        const subscriptionId = invoiceData.subscription as string | null

        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId)
          const userId = subscription.metadata?.supabase_user_id

          if (userId) {
            await supabase
              .from('subscriptions')
              .update({
                status: 'inactive',
                updated_at: new Date().toISOString(),
              })
              .eq('user_id', userId)
          }
        }
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook handler error:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}