'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from './supabase-client'
import type { User } from '@supabase/supabase-js'

interface Subscription {
  id: string
  user_id: string
  plan: 'monthly' | 'annual' | 'free'
  status: 'active' | 'canceled' | 'inactive' | 'trialing'
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  current_period_start: string | null
  current_period_end: string | null
}

export function useSubscription() {
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    const supabase = createClient()

    // Handle case when Supabase client is not available (build time)
    if (!supabase) {
      setLoading(false)
      return
    }

    async function getSubscription() {
      const client = createClient()
      if (!client) {
        setLoading(false)
        return
      }

      try {
        const { data: { user } } = await client.auth.getUser()
        setUser(user)

        if (user) {
          const { data, error } = await client
            .from('subscriptions')
            .select('*')
            .eq('user_id', user.id)
            .single()

          if (error && error.code !== 'PGRST116') {
            console.error('Error fetching subscription:', error)
          }
          setSubscription(data)
        }
      } catch (error) {
        console.error('Error:', error)
      } finally {
        setLoading(false)
      }
    }

    getSubscription()

    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null)
        const client = createClient()
        if (session?.user && client) {
          const { data } = await client
            .from('subscriptions')
            .select('*')
            .eq('user_id', session.user.id)
            .single()
          setSubscription(data)
        } else {
          setSubscription(null)
        }
      }
    )

    return () => {
      authSubscription.unsubscribe()
    }
  }, [])

  const signIn = useCallback(async () => {
    const supabase = createClient()
    if (!supabase) return

    // Get the current URL for redirect
    // Use the deployed URL, not localhost
    const redirectUrl = process.env.NEXT_PUBLIC_APP_URL 
      ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`
      : `${window.location.origin}/api/auth/callback`

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    })
    if (error) {
      console.error('Sign in error:', error)
      alert(`Sign in failed: ${error.message}`)
    }
  }, [])

  const signOut = useCallback(async () => {
    const supabase = createClient()
    if (!supabase) return

    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Sign out error:', error)
    }
    setUser(null)
    setSubscription(null)
  }, [])

  const checkout = useCallback(async (plan: 'monthly' | 'annual') => {
    try {
      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })

      const data = await response.json()

      if (data.url) {
        window.location.href = data.url
      } else {
        console.error('Checkout error:', data.error)
        alert(data.error || 'Failed to create checkout session')
      }
    } catch (error) {
      console.error('Checkout error:', error)
      alert('Failed to start checkout')
    }
  }, [])

  const isSubscribed = subscription?.status === 'active' || subscription?.status === 'trialing'

  return { subscription, loading, user, isSubscribed, signIn, signOut, checkout }
}
