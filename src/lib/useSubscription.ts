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
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    
    async function initialize() {
      try {
        const supabase = createClient()
        
        // Handle case when Supabase client is not available
        if (!supabase) {
          console.log('Supabase client not available')
          if (isMounted) {
            setLoading(false)
            setError('Supabase not configured')
          }
          return
        }

        // Check if there's a code in the URL (fallback for PKCE issues)
        if (typeof window !== 'undefined') {
          const urlParams = new URLSearchParams(window.location.search)
          const code = urlParams.get('code')
          
          if (code) {
            console.log('Found auth code in URL, attempting client-side exchange')
            // Try to exchange the code client-side
            const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
            
            if (exchangeError) {
              console.error('Client-side code exchange failed:', exchangeError)
            } else if (data.session) {
              console.log('Client-side code exchange successful')
            }
            
            // Clean up the URL
            window.history.replaceState({}, '', window.location.pathname)
          }
        }

        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        
        if (userError) {
          console.log('Auth error (expected if not logged in):', userError.message)
        }
        
        if (isMounted) {
          setUser(user ?? null)
        }

        // If user exists, get their subscription
        if (user && isMounted) {
          const { data, error: subError } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', user.id)
            .single()

          if (subError && subError.code !== 'PGRST116') {
            console.error('Error fetching subscription:', subError)
          }
          
          if (isMounted) {
            setSubscription(data ?? null)
          }
        }

        // Set up auth state listener
        const { data: { subscription: authListener } } = supabase.auth.onAuthStateChange(
          async (event, session) => {
            console.log('Auth state changed:', event)
            if (!isMounted) return
            
            setUser(session?.user ?? null)
            
            if (session?.user) {
              const { data } = await supabase
                .from('subscriptions')
                .select('*')
                .eq('user_id', session.user.id)
                .single()
              setSubscription(data ?? null)
            } else {
              setSubscription(null)
            }
          }
        )

        if (isMounted) {
          setLoading(false)
        }

        return () => {
          authListener.unsubscribe()
        }
      } catch (err) {
        console.error('Initialization error:', err)
        if (isMounted) {
          setLoading(false)
          setError(err instanceof Error ? err.message : 'Unknown error')
        }
      }
    }

    initialize()

    return () => {
      isMounted = false
    }
  }, [])

  const signIn = useCallback(async () => {
    const supabase = createClient()
    if (!supabase) {
      alert('Authentication not available. Please try again later.')
      return
    }

    try {
      const redirectUrl = `${window.location.origin}/api/auth/callback`
      console.log('Signing in with redirect:', redirectUrl)

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
    } catch (err) {
      console.error('Sign in exception:', err)
      alert('Sign in failed. Please try again.')
    }
  }, [])

  const signOut = useCallback(async () => {
    const supabase = createClient()
    if (!supabase) return

    try {
      // Sign out from Supabase
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('Sign out error:', error)
      }
      
      // Clear local state
      setUser(null)
      setSubscription(null)
      
      // Force reload to clear any cached state
      window.location.href = '/'
    } catch (err) {
      console.error('Sign out exception:', err)
    }
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
    } catch (err) {
      console.error('Checkout error:', err)
      alert('Failed to start checkout')
    }
  }, [])

  const isSubscribed = subscription?.status === 'active' || subscription?.status === 'trialing'

  return { subscription, loading, user, isSubscribed, signIn, signOut, checkout, error }
}
