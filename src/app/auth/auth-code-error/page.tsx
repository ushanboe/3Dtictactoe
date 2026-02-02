'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'

function ErrorContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  const description = searchParams.get('description')

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a1a] via-[#1a1a2e] to-[#16213e] flex items-center justify-center p-4">
      <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-8 max-w-md w-full text-center border border-white/10">
        <div className="text-6xl mb-4">⚠️</div>
        <h1 className="text-2xl font-bold text-white mb-4">Authentication Error</h1>
        
        {error && (
          <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-4 mb-4 text-left">
            <p className="text-red-300 font-mono text-sm break-all">
              <strong>Error:</strong> {error}
            </p>
            {description && (
              <p className="text-red-300/80 font-mono text-sm mt-2 break-all">
                <strong>Details:</strong> {description}
              </p>
            )}
          </div>
        )}
        
        <p className="text-gray-400 mb-6">
          There was a problem signing you in. This could be due to:
        </p>
        
        <ul className="text-gray-400 text-left mb-6 space-y-2">
          <li>• Session expired - try signing in again</li>
          <li>• Browser cookies blocked - enable cookies</li>
          <li>• Pop-up blocker - allow pop-ups for this site</li>
          <li>• OAuth configuration issue</li>
        </ul>
        
        <div className="flex flex-col gap-3">
          <Link
            href="/"
            className="w-full py-3 px-6 bg-gradient-to-r from-[#667eea] to-[#764ba2] rounded-xl font-semibold text-white hover:opacity-90 transition"
          >
            ← Back to Game
          </Link>
          <button
            onClick={() => window.location.href = '/'}
            className="w-full py-3 px-6 bg-white/10 hover:bg-white/20 rounded-xl font-semibold text-white transition"
          >
            Try Again
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AuthCodeErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a1a] via-[#1a1a2e] to-[#16213e] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <ErrorContent />
    </Suspense>
  )
}
