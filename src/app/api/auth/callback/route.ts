import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error = requestUrl.searchParams.get('error')
  const error_description = requestUrl.searchParams.get('error_description')
  const next = requestUrl.searchParams.get('next') ?? '/'
  
  // Get the base URL for redirects
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || requestUrl.origin

  // Handle OAuth errors from provider
  if (error) {
    console.error('OAuth error:', error, error_description)
    return NextResponse.redirect(
      `${baseUrl}/auth/auth-code-error?error=${encodeURIComponent(error)}&description=${encodeURIComponent(error_description || '')}`
    )
  }

  if (code) {
    const cookieStore = await cookies()
    
    // Log all cookies for debugging
    const allCookies = cookieStore.getAll()
    console.log('Available cookies:', allCookies.map(c => c.name))
    
    // Check for code verifier in cookies
    const codeVerifierCookie = allCookies.find(c => c.name.includes('code_verifier') || c.name.includes('pkce'))
    console.log('Code verifier cookie found:', codeVerifierCookie?.name)
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch (error) {
              // The `setAll` method was called from a Server Component.
            }
          },
        },
      }
    )

    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!exchangeError && data.session) {
      console.log('Session created successfully for user:', data.session.user.email)
      return NextResponse.redirect(`${baseUrl}${next}`)
    }
    
    console.error('Code exchange error:', exchangeError)
    
    // If PKCE error, redirect to home with a flag to handle client-side
    if (exchangeError?.message?.includes('code verifier')) {
      // Redirect to home page with the code, let client handle it
      return NextResponse.redirect(`${baseUrl}/?code=${code}`)
    }
    
    return NextResponse.redirect(
      `${baseUrl}/auth/auth-code-error?error=${encodeURIComponent(exchangeError?.message || 'Unknown error')}`
    )
  }

  // No code provided - just redirect home
  return NextResponse.redirect(baseUrl)
}
