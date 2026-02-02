'use client'

import { useSubscription } from '@/lib/useSubscription'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function PricingContent() {
  const { subscription, loading, user } = useSubscription()
  const searchParams = useSearchParams()
  const success = searchParams.get('success')
  const canceled = searchParams.get('canceled')

  const handleCheckout = async (plan: 'monthly' | 'annual') => {
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
        alert(data.error || 'Failed to create checkout session')
      }
    } catch (error) {
      console.error('Checkout error:', error)
      alert('Failed to start checkout')
    }
  }

  if (canceled) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] flex items-center justify-center p-4">
        <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-8 max-w-md text-center border border-white/10">
          <h2 className="text-2xl font-bold text-white mb-4">Checkout Canceled</h2>
          <p className="text-yellow-400">Checkout was canceled. Feel free to try again when you&apos;re ready!</p>
          <Link href="/" className="mt-6 inline-block px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl text-white font-semibold">
            Back to Game
          </Link>
        </div>
      </div>
    )
  }

  if (success || (subscription && subscription.status === 'active')) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] flex items-center justify-center p-4">
        <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-8 max-w-md text-center border border-white/10">
          <h2 className="text-2xl font-bold text-green-400 mb-4">✓ You&apos;re a Premium Member!</h2>
          <p className="text-gray-300 mb-6">You have full access to online multiplayer mode.</p>
          <Link href="/" className="inline-block px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl text-white font-semibold">
            Play Now
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">Upgrade to Premium</h1>
          <p className="text-gray-400 text-lg">Unlock online multiplayer and play with friends worldwide!</p>
        </div>

        {!user && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-8 text-center">
            <p className="text-yellow-400">Please sign in to subscribe</p>
            <Link href="/" className="text-purple-400 hover:text-purple-300 underline mt-2 inline-block">
              Go to game and sign in
            </Link>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-8">
          {/* Monthly Plan */}
          <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-8 border border-white/10 hover:border-purple-500/50 transition-all">
            <h3 className="text-xl font-bold text-white mb-2">Monthly</h3>
            <div className="mb-6">
              <span className="text-4xl font-bold text-white">$1.99</span>
              <span className="text-gray-400">/month</span>
            </div>
            <ul className="space-y-3 mb-8">
              <li className="flex items-center text-gray-300">
                <span className="text-green-400 mr-2">✓</span> Online Multiplayer
              </li>
              <li className="flex items-center text-gray-300">
                <span className="text-green-400 mr-2">✓</span> Play with Friends
              </li>
              <li className="flex items-center text-gray-300">
                <span className="text-green-400 mr-2">✓</span> Cancel Anytime
              </li>
            </ul>
            <button
              onClick={() => handleCheckout('monthly')}
              disabled={loading || !user}
              className="w-full py-3 px-6 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Loading...' : 'Subscribe Monthly'}
            </button>
          </div>

          {/* Annual Plan */}
          <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-8 border-2 border-purple-500/50 relative hover:border-purple-400 transition-all">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-1 rounded-full text-sm font-semibold text-white">
              Best Value
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Annual</h3>
            <div className="mb-6">
              <span className="text-4xl font-bold text-white">$10</span>
              <span className="text-gray-400">/year</span>
              <span className="ml-2 text-green-400 text-sm">Save 58%</span>
            </div>
            <ul className="space-y-3 mb-8">
              <li className="flex items-center text-gray-300">
                <span className="text-green-400 mr-2">✓</span> Online Multiplayer
              </li>
              <li className="flex items-center text-gray-300">
                <span className="text-green-400 mr-2">✓</span> Play with Friends
              </li>
              <li className="flex items-center text-gray-300">
                <span className="text-green-400 mr-2">✓</span> Cancel Anytime
              </li>
              <li className="flex items-center text-gray-300">
                <span className="text-green-400 mr-2">✓</span> 2 Months Free
              </li>
            </ul>
            <button
              onClick={() => handleCheckout('annual')}
              disabled={loading || !user}
              className="w-full py-3 px-6 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Loading...' : 'Subscribe Annually'}
            </button>
          </div>
        </div>

        <div className="text-center mt-8">
          <Link href="/" className="text-gray-400 hover:text-white transition-colors">
            ← Back to Game
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function PricingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    }>
      <PricingContent />
    </Suspense>
  )
}